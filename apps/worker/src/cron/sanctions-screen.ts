import { connectDb, WatchlistEntity, Alert, SanctionsList, SanctionsReviewQueue, SupplierLink, Counterparty } from '@syntra/db';
import type { IWatchlistEntity, ISanctionsEntry, ISanctionsList } from '@syntra/db';
import { compositeSanctionsMatch } from '@syntra/shared/utils/sanctions-match';
import { ofacProvider } from '../feeds/ofac-provider.js';
import { Types } from 'mongoose';

type SanctionsListName = ISanctionsList['list_name'];

// ---------------------------------------------------------------------------
// Alert creation for confirmed sanctions hits (score >= 90)
// ---------------------------------------------------------------------------

async function createSanctionsAlert(
  orgId: Types.ObjectId,
  entity: IWatchlistEntity,
  upstreamEntities: IWatchlistEntity[],
  entry: ISanctionsEntry,
  listName: string,
  matchedName: string,
  matchScore: number,
): Promise<void> {
  const existing = await Alert.findOne({
    org_id: orgId,
    'event_snapshot.event_type': 'sanctions_match',
    watchlist_entity_ids: entity._id,
    'event_snapshot.sources.name': listName,
  });
  if (existing) return; // idempotent

  const impactedEntities = [entity, ...upstreamEntities];
  const upstreamText = upstreamEntities.length > 0
    ? ` Upstream relationship impact: ${[entity.name, ...upstreamEntities.map(e => e.name)].join(' -> ')}.`
    : '';

  await Alert.create({
    org_id: orgId,
    event_id: new Types.ObjectId(), // synthetic — no geopolitical event backing this
    watchlist_entity_ids: impactedEntities.map(e => e._id),
    severity: 'critical',
    subtype: 'sanctions_match',
    match_reasons: [],
    event_snapshot: {
      title: `Sanctions Match: ${entity.name}`,
      description:
        `Entity "${entity.name}" matched sanctions list entry "${entry.name}" ` +
        `on ${listName} with score ${matchScore}/100. ` +
        `Programs: ${entry.programs.join(', ')}. ` +
        `Matched on: "${matchedName}".${upstreamText}`,
      location: { lat: entity.latitude ?? 0, lng: entity.longitude ?? 0 },
      country: entity.country_code ?? '',
      country_code: entity.country_code ?? '',
      event_type: 'sanctions_match',
      occurred_at: new Date(),
      sources: [{ url: entry.source_url, name: listName }],
    },
    llm_context: { why_matters: null, recommended_actions: [] },
    dispatched_at: null,
    channels_sent: [],
    acknowledged_at: null,
    acknowledged_by_user_id: null,
    acknowledgement_note: null,
  });
}

// ---------------------------------------------------------------------------
// Review queue upsert for review/audit hits (70-89 pending, >=90 confirmed)
// ---------------------------------------------------------------------------

async function upsertReviewQueue(
  orgId: Types.ObjectId,
  entity: IWatchlistEntity,
  entry: ISanctionsEntry,
  listName: string,
  listVersion: string,
  matchedName: string,
  matchScore: number,
  status: 'pending' | 'confirmed' = 'pending',
): Promise<void> {
  await SanctionsReviewQueue.findOneAndUpdate(
    { entity_id: entity._id, list_name: listName },
    {
      org_id: orgId,
      entity_name: entity.name,
      list_name: listName,
      matched_name: matchedName,
      match_score: matchScore,
      list_version: listVersion,
      entry: {
        name: entry.name,
        aliases: entry.aliases,
        country: entry.country,
        dob: entry.dob,
        address: entry.address,
        id_numbers: entry.id_numbers,
        programs: entry.programs,
        source_url: entry.source_url,
      },
      screened_at: new Date(),
      status,
    },
    { upsert: true, new: true },
  );
}

// ---------------------------------------------------------------------------
// Refresh sanctions list from provider into DB
// ---------------------------------------------------------------------------

async function refreshSanctionsList(
  listName: SanctionsListName,
  entries: ISanctionsEntry[],
): Promise<{ version: string }> {
  const version = new Date().toISOString().slice(0, 10);
  await SanctionsList.findOneAndUpdate(
    { list_name: listName, version },
    { list_name: listName, version, entries, entry_count: entries.length, updated_at: new Date() },
    { upsert: true, new: true },
  );
  return { version };
}

async function latestPersistedSanctionsLists(
  refreshed: Array<{ list_name: SanctionsListName; version: string; entries: ISanctionsEntry[] }>,
): Promise<Array<{ list_name: SanctionsListName; version: string; entries: ISanctionsEntry[] }>> {
  const latestByName = new Map<SanctionsListName, { list_name: SanctionsListName; version: string; entries: ISanctionsEntry[] }>();
  for (const list of refreshed) latestByName.set(list.list_name, list);

  const lists = await SanctionsList.find({})
    .sort({ list_name: 1, updated_at: -1 })
    .lean() as unknown as ISanctionsList[];

  for (const list of lists) {
    if (!latestByName.has(list.list_name)) {
      latestByName.set(list.list_name, {
        list_name: list.list_name,
        version: list.version,
        entries: list.entries,
      });
    }
  }

  return [...latestByName.values()];
}

async function upstreamRelationshipMatches(
  orgId: Types.ObjectId,
  entity: IWatchlistEntity,
): Promise<IWatchlistEntity[]> {
  const seen = new Set<string>([String(entity._id)]);
  const upstream: IWatchlistEntity[] = [];
  let frontier = [entity._id as Types.ObjectId];

  for (let depth = 0; depth < 10 && frontier.length > 0; depth++) {
    const [links, counterparties] = await Promise.all([
      SupplierLink.find({
        org_id: orgId,
        child_entity_id: { $in: frontier },
      }).lean(),
      Counterparty.find({
        org_id: orgId,
        entity_id: { $in: frontier },
        active: true,
        parent_entity_id: { $ne: null },
      }).lean(),
    ]);

    const parentIds: Types.ObjectId[] = [];
    for (const link of links) {
      const parentId = link.parent_entity_id as Types.ObjectId;
      const key = String(parentId);
      if (seen.has(key)) continue;
      seen.add(key);
      parentIds.push(parentId);
    }
    for (const counterparty of counterparties) {
      const parentId = counterparty.parent_entity_id as Types.ObjectId | null;
      if (!parentId) continue;
      const key = String(parentId);
      if (seen.has(key)) continue;
      seen.add(key);
      parentIds.push(parentId);
    }

    if (parentIds.length === 0) break;

    const parents = await WatchlistEntity.find({
      _id: { $in: parentIds },
      org_id: orgId,
      active: true,
    }).lean() as unknown as IWatchlistEntity[];

    upstream.push(...parents);
    frontier = parents.map(parent => parent._id as Types.ObjectId);
  }

  return upstream;
}

// ---------------------------------------------------------------------------
// Main daily screening cycle
// ---------------------------------------------------------------------------

export interface SanctionsScreenResult {
  entitiesScreened: number;
  autoAlerts: number;
  reviewQueueEntries: number;
}

export async function runSanctionsScreeningCycle(): Promise<SanctionsScreenResult> {
  await connectDb();

  const ofacEntries = await ofacProvider.fetch({}, { org_id: 'system' });
  const { version: ofacVersion } = await refreshSanctionsList('ofac_sdn', ofacEntries);
  const sanctionsLists = await latestPersistedSanctionsLists([
    { list_name: 'ofac_sdn', version: ofacVersion, entries: ofacEntries },
  ]);

  const entities = await WatchlistEntity.find({ active: true }).lean() as unknown as IWatchlistEntity[];

  let autoAlerts = 0;
  let reviewQueueEntries = 0;

  for (const entity of entities) {
    for (const list of sanctionsLists) {
      let topScore = 0;
      let topMatchedName = '';
      let topEntry = list.entries[0];

      for (const entry of list.entries) {
        const result = compositeSanctionsMatch(entity, entry);
        if (result.score > topScore) {
          topScore = result.score;
          topMatchedName = result.matchedSanctionsName;
          topEntry = entry;
        }
      }

      if (!topEntry) continue;

      const orgId = entity.org_id as unknown as Types.ObjectId;
      if (topScore >= 90) {
        const upstreamEntities = await upstreamRelationshipMatches(orgId, entity);
        await createSanctionsAlert(
          orgId,
          entity,
          upstreamEntities,
          topEntry,
          list.list_name,
          topMatchedName,
          topScore,
        );
        await upsertReviewQueue(
          orgId,
          entity,
          topEntry,
          list.list_name,
          list.version,
          topMatchedName,
          topScore,
          'confirmed',
        );
        autoAlerts++;
      } else if (topScore >= 70) {
        await upsertReviewQueue(
          orgId,
          entity,
          topEntry,
          list.list_name,
          list.version,
          topMatchedName,
          topScore,
        );
        reviewQueueEntries++;
      }
    }
  }

  console.log(
    `[sanctions] screened=${entities.length} auto_alerts=${autoAlerts} review_queue=${reviewQueueEntries}`,
  );
  return { entitiesScreened: entities.length, autoAlerts, reviewQueueEntries };
}

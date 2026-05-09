import { connectDb, WatchlistEntity, Alert, SanctionsList, SanctionsReviewQueue } from '@syntra/db';
import type { IWatchlistEntity, ISanctionsEntry } from '@syntra/db';
import { bestMatchScore } from '@syntra/shared';
import { ofacProvider } from '../feeds/ofac-provider.js';
import { Types } from 'mongoose';

// ---------------------------------------------------------------------------
// Alert creation for confirmed sanctions hits (score >= 95)
// ---------------------------------------------------------------------------

async function createSanctionsAlert(
  orgId: Types.ObjectId,
  entity: IWatchlistEntity,
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

  await Alert.create({
    org_id: orgId,
    event_id: new Types.ObjectId(), // synthetic — no geopolitical event backing this
    watchlist_entity_ids: [entity._id],
    severity: 'critical',
    subtype: 'sanctions_match',
    match_reasons: [],
    event_snapshot: {
      title: `Sanctions Match: ${entity.name}`,
      description:
        `Entity "${entity.name}" matched sanctions list entry "${entry.name}" ` +
        `on ${listName} with score ${matchScore}/100. ` +
        `Programs: ${entry.programs.join(', ')}. ` +
        `Matched on: "${matchedName}".`,
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
// Review queue upsert for borderline hits (80-94)
// ---------------------------------------------------------------------------

async function upsertReviewQueue(
  orgId: Types.ObjectId,
  entity: IWatchlistEntity,
  entry: ISanctionsEntry,
  listName: string,
  listVersion: string,
  matchedName: string,
  matchScore: number,
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
        id_numbers: entry.id_numbers,
        programs: entry.programs,
        source_url: entry.source_url,
      },
      screened_at: new Date(),
      status: 'pending',
    },
    { upsert: true, new: true },
  );
}

// ---------------------------------------------------------------------------
// Refresh sanctions list from provider into DB
// ---------------------------------------------------------------------------

async function refreshSanctionsList(
  listName: 'ofac_sdn',
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

  const entities = await WatchlistEntity.find({ active: true }).lean() as unknown as IWatchlistEntity[];

  let autoAlerts = 0;
  let reviewQueueEntries = 0;

  for (const entity of entities) {
    const entityNames = [entity.name];
    const meta = entity.metadata as Record<string, unknown>;
    if (Array.isArray(meta.aliases)) {
      for (const a of meta.aliases) {
        if (typeof a === 'string') entityNames.push(a);
      }
    }

    let topScore = 0;
    let topMatchedName = '';
    let topEntry = ofacEntries[0];

    for (const entry of ofacEntries) {
      const { score, matchedName } = bestMatchScore(entityNames, entry);
      if (score > topScore) {
        topScore = score;
        topMatchedName = matchedName;
        topEntry = entry;
      }
    }

    if (!topEntry) continue;

    if (topScore >= 95) {
      await createSanctionsAlert(
        entity.org_id as unknown as Types.ObjectId,
        entity,
        topEntry,
        'ofac_sdn',
        topMatchedName,
        topScore,
      );
      autoAlerts++;
    } else if (topScore >= 80) {
      await upsertReviewQueue(
        entity.org_id as unknown as Types.ObjectId,
        entity,
        topEntry,
        'ofac_sdn',
        ofacVersion,
        topMatchedName,
        topScore,
      );
      reviewQueueEntries++;
    }
  }

  console.log(
    `[sanctions] screened=${entities.length} auto_alerts=${autoAlerts} review_queue=${reviewQueueEntries}`,
  );
  return { entitiesScreened: entities.length, autoAlerts, reviewQueueEntries };
}

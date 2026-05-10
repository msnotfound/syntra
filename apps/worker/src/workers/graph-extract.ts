import { Queue, Worker } from 'bullmq';
import { Types } from 'mongoose';
import {
  Alert,
  Counterparty,
  SourceReliability,
  SupplierLink,
  WatchlistEntity,
  connectDb,
} from '@syntra/db';
import type { IAlert, ISupplierLink, IWatchlistEntity } from '@syntra/db';
import { callLLMJson, renderTemplate, SUPPLIER_RELATIONSHIP_EXTRACT } from '@syntra/llm';
import { KNOWN_SOURCES, resolveSourceId } from '@syntra/shared/utils/intel-provenance';

const REDIS_URL = process.env.UPSTASH_REDIS_URL;
const connection = REDIS_URL
  ? { url: REDIS_URL }
  : { host: 'localhost', port: 6379 };

const MIN_RELATIONSHIP_CONFIDENCE = 60;

let queue: Queue | null = null;

export type SupplierLinkSource = 'manual' | 'extracted' | 'imported' | 'imported_csv';

export interface RawExtractedSupplierRelationship {
  supplier_name?: string;
  buyer_name?: string;
  relationship?: string;
  confidence_pct?: number;
  evidence?: string;
}

export interface NormalizedSupplierRelationship {
  supplierName: string;
  buyerName: string;
  confidencePct: number;
  evidence: string;
}

export interface ExistingSupplierLinkLike {
  _id: Types.ObjectId;
  source: SupplierLinkSource;
  confidence_pct?: number;
}

interface SupplierLinkCandidate {
  source: SupplierLinkSource;
  confidence_pct: number;
  evidence?: string | null;
}

type LinkWriteDecision =
  | { action: 'create'; fields: SupplierLinkCandidate }
  | { action: 'update'; fields: SupplierLinkCandidate }
  | { action: 'skip'; reason: 'manual_existing' | 'lower_or_equal_confidence' };

interface ExtractResponse {
  relationships?: RawExtractedSupplierRelationship[];
}

export function getGraphExtractQueue(): Queue {
  if (!queue) queue = new Queue('graph-extract', { connection });
  return queue;
}

export function startGraphExtractWorker() {
  const worker = new Worker('graph-extract', async (job) => {
    const { alertId, entityId, orgId } = job.data as { alertId?: string; entityId?: string; orgId?: string };
    await connectDb();

    if (alertId) {
      await extractSupplierRelationshipsForAlert(alertId);
    }
    if (entityId) {
      const alert = alertId ? await Alert.findById(alertId).lean() as IAlert | null : null;
      const resolvedOrgId = orgId ?? (alert?.org_id ? String(alert.org_id) : null);
      if (resolvedOrgId) {
        await proposeTierOneCounterpartySuppliers(resolvedOrgId, entityId);
      }
    }
  }, { connection });

  worker.on('failed', (job, err) =>
    console.error('[graph-extract] Job failed', job?.id, err.message),
  );
  return worker;
}

export function normalizeExtractedRelationships(
  rows: RawExtractedSupplierRelationship[],
): NormalizedSupplierRelationship[] {
  return rows.flatMap(row => {
    const supplierName = cleanName(row.supplier_name);
    const buyerName = cleanName(row.buyer_name);
    const confidencePct = clampPct(row.confidence_pct ?? 0);
    const evidence = (row.evidence ?? '').replace(/\s+/g, ' ').trim();

    if (!supplierName || !buyerName || supplierName === buyerName) return [];
    if (confidencePct < MIN_RELATIONSHIP_CONFIDENCE) return [];

    return [{ supplierName, buyerName, confidencePct, evidence }];
  });
}

export function computeSupplierLinkConfidence(
  source: SupplierLinkSource,
  sourceReliabilityPct?: number | null,
): number {
  if (source === 'manual') return 100;
  if (source === 'imported' || source === 'imported_csv') return 85;
  return clampPct(sourceReliabilityPct ?? MIN_RELATIONSHIP_CONFIDENCE);
}

export function resolveSupplierLinkWrite(
  existing: ExistingSupplierLinkLike | null,
  candidate: SupplierLinkCandidate,
): LinkWriteDecision {
  if (!existing) return { action: 'create', fields: candidate };
  if (existing.source === 'manual') return { action: 'skip', reason: 'manual_existing' };
  if ((existing.confidence_pct ?? 0) >= candidate.confidence_pct) {
    return { action: 'skip', reason: 'lower_or_equal_confidence' };
  }
  return { action: 'update', fields: candidate };
}

export async function extractSupplierRelationshipsForAlert(alertId: string): Promise<{
  created: number;
  updated: number;
  skipped: number;
}> {
  const alert = await Alert.findById(alertId).lean() as IAlert | null;
  if (!alert) return { created: 0, updated: 0, skipped: 0 };

  const entities = await WatchlistEntity.find({
    org_id: alert.org_id,
    active: true,
    type: 'supplier',
  }).lean() as unknown as IWatchlistEntity[];

  if (entities.length === 0) return { created: 0, updated: 0, skipped: 0 };

  const sourceReliabilityPct = await resolveEventSourceReliabilityPct(alert.event_snapshot.sources);
  const prompt = renderTemplate(SUPPLIER_RELATIONSHIP_EXTRACT.template, {
    event_description: alert.event_snapshot.description,
    known_entities: entities.map(e => e.name).join(', '),
  });

  const extracted = await callLLMJson<ExtractResponse>(
    SUPPLIER_RELATIONSHIP_EXTRACT.model,
    SUPPLIER_RELATIONSHIP_EXTRACT.system,
    prompt,
    async () => ({ relationships: [] }),
  );

  const normalized = normalizeExtractedRelationships(extracted.relationships ?? []);
  const entityByName = new Map(entities.map(e => [normalizeNameKey(e.name), e]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const relationship of normalized) {
    const supplier = entityByName.get(normalizeNameKey(relationship.supplierName));
    const buyer = entityByName.get(normalizeNameKey(relationship.buyerName));
    if (!supplier || !buyer) {
      skipped++;
      continue;
    }

    const result = await upsertSupplierLink({
      orgId: alert.org_id,
      parentEntityId: asObjectId(buyer._id),
      childEntityId: asObjectId(supplier._id),
      tierOffset: 1,
      candidate: {
        source: 'extracted',
        confidence_pct: computeSupplierLinkConfidence('extracted', sourceReliabilityPct),
        evidence: relationship.evidence,
      },
    });
    created += result.created;
    updated += result.updated;
    skipped += result.skipped;
  }

  for (const entityId of alert.watchlist_entity_ids.map(String)) {
    const inferred = await proposeTierOneCounterpartySuppliers(String(alert.org_id), entityId);
    created += inferred.created;
    updated += inferred.updated;
    skipped += inferred.skipped;
  }

  return { created, updated, skipped };
}

export async function proposeTierOneCounterpartySuppliers(
  orgId: string,
  entityId: string,
): Promise<{ created: number; updated: number; skipped: number }> {
  const counterparties = await Counterparty.find({
    org_id: new Types.ObjectId(orgId),
    role: 'supplier',
    active: true,
  }).lean();

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const cp of counterparties) {
    const supplierEntityId = String(cp.entity_id);
    if (supplierEntityId === entityId) {
      skipped++;
      continue;
    }

    const supplier = await WatchlistEntity.findOne({
      _id: cp.entity_id,
      org_id: new Types.ObjectId(orgId),
      active: true,
      type: 'supplier',
    }).lean();
    if (!supplier) {
      skipped++;
      continue;
    }

    const result = await upsertSupplierLink({
      orgId: new Types.ObjectId(orgId),
      parentEntityId: new Types.ObjectId(entityId),
      childEntityId: cp.entity_id,
      tierOffset: 1,
      candidate: {
        source: 'imported_csv',
        confidence_pct: computeSupplierLinkConfidence('imported_csv'),
        evidence: 'Inferred from active supplier counterparty record.',
      },
    });
    created += result.created;
    updated += result.updated;
    skipped += result.skipped;
  }

  return { created, updated, skipped };
}

async function upsertSupplierLink(input: {
  orgId: Types.ObjectId;
  parentEntityId: Types.ObjectId;
  childEntityId: Types.ObjectId;
  tierOffset: 1 | 2 | 3;
  candidate: SupplierLinkCandidate;
}): Promise<{ created: number; updated: number; skipped: number }> {
  const existing = await SupplierLink.findOne({
    org_id: input.orgId,
    parent_entity_id: input.parentEntityId,
    child_entity_id: input.childEntityId,
  }).lean() as (ISupplierLink & { _id: Types.ObjectId }) | null;

  const decision = resolveSupplierLinkWrite(existing, input.candidate);
  if (decision.action === 'skip') return { created: 0, updated: 0, skipped: 1 };

  if (decision.action === 'create') {
    await SupplierLink.create({
      org_id: input.orgId,
      parent_entity_id: input.parentEntityId,
      child_entity_id: input.childEntityId,
      tier_offset: input.tierOffset,
      ...decision.fields,
    });
    await updateInferredSupplierTier(input.orgId, input.parentEntityId, input.childEntityId, input.tierOffset);
    return { created: 1, updated: 0, skipped: 0 };
  }

  await SupplierLink.updateOne(
    { _id: existing!._id },
    {
      $set: {
        source: decision.fields.source,
        confidence_pct: decision.fields.confidence_pct,
        evidence: decision.fields.evidence ?? null,
        tier_offset: input.tierOffset,
      },
    },
  );
  await updateInferredSupplierTier(input.orgId, input.parentEntityId, input.childEntityId, input.tierOffset);
  return { created: 0, updated: 1, skipped: 0 };
}

async function updateInferredSupplierTier(
  orgId: Types.ObjectId,
  parentEntityId: Types.ObjectId,
  childEntityId: Types.ObjectId,
  tierOffset: 1 | 2 | 3,
): Promise<void> {
  const parent = await WatchlistEntity.findOne({ _id: parentEntityId, org_id: orgId }).select('supplier_tier').lean();
  const parentTier = typeof parent?.supplier_tier === 'number' ? parent.supplier_tier : 0;
  const inferredTier = Math.min(3, Math.max(1, parentTier + tierOffset));

  await WatchlistEntity.updateOne(
    {
      _id: childEntityId,
      org_id: orgId,
      $or: [{ supplier_tier: null }, { supplier_tier: { $gt: inferredTier } }],
    },
    { $set: { supplier_tier: inferredTier } },
  );
}

async function resolveEventSourceReliabilityPct(
  sources: Array<{ url: string; name: string }>,
): Promise<number> {
  const sourceIds = [...new Set(sources.map(s => resolveSourceId(s.name)))];
  const dbReliability = sourceIds.length
    ? await SourceReliability.find({ source_id: { $in: sourceIds } }).lean()
    : [];
  const scores = dbReliability.map(s => s.reliability_pct);

  for (const sourceId of sourceIds) {
    const known = KNOWN_SOURCES.find(s => s.source_id === sourceId);
    if (known) scores.push(known.reliability_pct);
  }

  return scores.length ? Math.max(...scores) : MIN_RELATIONSHIP_CONFIDENCE;
}

function cleanName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeNameKey(value: string): string {
  return cleanName(value).toLowerCase();
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function asObjectId(value: unknown): Types.ObjectId {
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(String(value));
}

import { Queue, Worker } from 'bullmq';
import { connectDb, Alert, IntelClaim, SourceReliability } from '@syntra/db';
import type { IAlert } from '@syntra/db';
import { callLLMJson } from '@syntra/llm';
import { resolveSourceId, fallbackExtract } from '@syntra/shared/utils/intel-provenance';
import type { ExtractOutput } from '@syntra/shared/utils/intel-provenance';
import type { Types } from 'mongoose';

// ---------------------------------------------------------------------------
// LLM prompt — INTEL_CLAIM_EXTRACT (pending CCR m28-01 for registry entry)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
  'You are an intelligence analyst. Extract discrete, verifiable claims from a news source describing a geopolitical event. Each claim must be atomic (one fact per claim), precisely worded, and classifiable as: "fact" (observed/reported), "inference" (derived from facts), or "forecast" (projection of future state). Return only valid JSON.';

const USER_TEMPLATE = `Event title: {title}
Event description: {description}
Source: {source_name} ({source_url})

Extract up to 5 atomic claims from this event. For each claim return:
- claim_text: one-sentence statement of the claim
- claim_type: "fact" | "inference" | "forecast"
- evidence_url: the source URL

Return JSON: { "claims": [ { "claim_text": string, "claim_type": string, "evidence_url": string } ] }`;

// ---------------------------------------------------------------------------
// Queue + Worker
// ---------------------------------------------------------------------------

const REDIS_URL = process.env.UPSTASH_REDIS_URL;
const connection = REDIS_URL
  ? { url: REDIS_URL }
  : { host: 'localhost', port: 6379 };

let queue: Queue | null = null;

export function getIntelExtractQueue(): Queue {
  if (!queue) queue = new Queue('intel-claim-extract', { connection });
  return queue;
}

export function startIntelExtractWorker() {
  const worker = new Worker('intel-claim-extract', async (job) => {
    const { alertId } = job.data as { alertId: string };
    await connectDb();

    const alert = await Alert.findById(alertId).lean() as IAlert | null;
    if (!alert) return;

    const sources = alert.event_snapshot?.sources ?? [];
    if (sources.length === 0) return;

    const asserted_at = alert.event_snapshot?.occurred_at ?? new Date();
    const createdClaimIds: Types.ObjectId[] = [];

    for (const src of sources) {
      const sourceId = resolveSourceId(src.name);

      const srcDoc = await SourceReliability.findOne({ source_id: sourceId }).lean();
      if (!srcDoc) continue;

      const userMsg = USER_TEMPLATE
        .replace('{title}', alert.event_snapshot.title ?? '')
        .replace('{description}', alert.event_snapshot.description ?? '')
        .replace('{source_name}', src.name)
        .replace('{source_url}', src.url);

      const extracted = await callLLMJson<ExtractOutput>(
        'claude-haiku-4-5-20251001',
        SYSTEM_PROMPT,
        userMsg,
        async () => fallbackExtract(
          alert.event_snapshot.title,
          alert.event_snapshot.description,
          src.url,
        ),
      );

      for (const c of extracted.claims ?? []) {
        const validTypes = ['fact', 'inference', 'forecast'];
        if (!validTypes.includes(c.claim_type)) continue;

        const claim = await IntelClaim.create({
          source_id:        srcDoc._id,
          claim_text:       c.claim_text,
          evidence_url:     c.evidence_url || src.url,
          asserted_at,
          parent_claim_ids: createdClaimIds.slice(),
          claim_type:       c.claim_type as 'fact' | 'inference' | 'forecast',
          alert_id:         alert._id,
        });
        createdClaimIds.push(claim._id as Types.ObjectId);
      }
    }
  }, { connection });

  worker.on('failed', (job, err) =>
    console.error('[intel-extract] Job failed', job?.id, err.message),
  );
  return worker;
}

// ---------------------------------------------------------------------------
// Helper: build provenance chain (claim + all ancestor claims in order)
// ---------------------------------------------------------------------------

export async function buildProvenanceChain(claimId: string): Promise<Array<{
  claim: Awaited<ReturnType<typeof IntelClaim.findById>>;
  depth: number;
}>> {
  const chain: Array<{ claim: Awaited<ReturnType<typeof IntelClaim.findById>>; depth: number }> = [];
  const visited = new Set<string>();

  async function walk(id: string, depth: number) {
    if (visited.has(id)) return;
    visited.add(id);
    const claim = await IntelClaim.findById(id)
      .populate('source_id')
      .lean();
    if (!claim) return;
    chain.push({ claim, depth });
    for (const parentId of claim.parent_claim_ids ?? []) {
      await walk(String(parentId), depth + 1);
    }
  }

  await walk(claimId, 0);
  return chain;
}

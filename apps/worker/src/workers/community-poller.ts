import { connectDb, CustomSource, IntelClaim, SourceReliability } from '@syntra/db';
import { decryptToken } from '@syntra/shared/token-encrypt';
import type { Types } from 'mongoose';
import {
  extractClaimsFromRssItem,
  parseRss,
  shouldMarkFailed,
} from './community-poller-utils.js';

export {
  validateWebhookSignature,
  extractClaimsFromRssItem,
  normalizeWebhookPayload,
  shouldMarkFailed,
  parseRss,
} from './community-poller-utils.js';
export type { RssItem, ClaimExtract } from './community-poller-utils.js';

// ---------------------------------------------------------------------------
// RSS fetch with optional auth
// ---------------------------------------------------------------------------

async function fetchRss(url: string, authType?: string | null, authTokenEnc?: string | null): Promise<string> {
  const headers: Record<string, string> = { 'User-Agent': 'Syntra/1.0 (+https://syntra.app)' };
  if (authType === 'bearer' && authTokenEnc) {
    headers['Authorization'] = `Bearer ${decryptToken(authTokenEnc)}`;
  } else if (authType === 'basic' && authTokenEnc) {
    headers['Authorization'] = `Basic ${decryptToken(authTokenEnc)}`;
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.text();
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function ensureCustomSourceReliability(
  customSourceId: string,
  sourceName: string,
): Promise<Types.ObjectId> {
  const slug = `custom-${customSourceId}`;
  const doc = await SourceReliability.findOneAndUpdate(
    { source_id: slug },
    {
      $setOnInsert: {
        source_id: slug,
        source_name: sourceName,
        admiralty_code: 'F',
        reliability_pct: 0,
        last_assessed_at: new Date(),
      },
    },
    { upsert: true, new: true },
  );
  return doc!._id as Types.ObjectId;
}

async function claimExists(sourceRefId: Types.ObjectId, text: string): Promise<boolean> {
  return (await IntelClaim.countDocuments({ source_id: sourceRefId, claim_text: text })) > 0;
}

// ---------------------------------------------------------------------------
// Poll cycle — called by cron every 15 minutes
// ---------------------------------------------------------------------------

export interface CommunityPollResult {
  polled: number;
  claims: number;
  errors: number;
}

export async function runCommunityPollCycle(): Promise<CommunityPollResult> {
  await connectDb();
  const result: CommunityPollResult = { polled: 0, claims: 0, errors: 0 };

  // Only RSS sources are polled; telegram/discord/webhook use the push endpoint
  const sources = await CustomSource.find({ status: 'active', source_type: 'rss-private' }).lean();

  for (const src of sources) {
    const cfg = src.config ?? {};
    if (!cfg.url) continue;

    try {
      const xml = await fetchRss(cfg.url, cfg.auth_type, cfg.auth_token_enc);
      const items = parseRss(xml);
      const sourceRefId = await ensureCustomSourceReliability(String(src._id), src.name);
      let created = 0;

      for (const item of items) {
        const claims = extractClaimsFromRssItem(item);
        for (const claim of claims) {
          if (await claimExists(sourceRefId, claim.claim_text)) continue;
          await IntelClaim.create({
            source_id: sourceRefId,
            claim_text: claim.claim_text,
            evidence_url: claim.evidence_url,
            asserted_at: claim.asserted_at,
            parent_claim_ids: [],
            claim_type: claim.claim_type,
            alert_id: null,
          });
          created++;
        }
      }

      await CustomSource.updateOne({ _id: src._id }, { last_polled_at: new Date(), error_count: 0 });
      result.polled++;
      result.claims += created;
    } catch (err) {
      result.errors++;
      const newCount = (src.error_count ?? 0) + 1;
      await CustomSource.updateOne(
        { _id: src._id },
        {
          $inc: { error_count: 1 },
          ...(shouldMarkFailed(newCount) ? { status: 'failed' } : {}),
        },
      );
      console.error(`[community-poll:${src.name}] Error:`, (err as Error).message);
    }
  }

  return result;
}

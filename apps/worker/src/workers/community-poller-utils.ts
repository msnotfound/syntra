import { createHmac, timingSafeEqual } from 'crypto';

// ---------------------------------------------------------------------------
// Pure helpers — no DB imports. Exported separately so tests can load
// them without triggering the Mongoose connection chain.
// ---------------------------------------------------------------------------

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

export interface ClaimExtract {
  claim_text: string;
  evidence_url: string | null;
  claim_type: 'fact' | 'inference' | 'forecast';
  asserted_at: Date;
}

/** Validate HMAC-SHA256 signature. Header format: "sha256=<hex>" */
export function validateWebhookSignature(
  body: Buffer,
  secret: string,
  signatureHeader: string,
): boolean {
  if (!secret) return false;
  const hexSig = signatureHeader.replace(/^sha256=/, '');
  if (!hexSig || hexSig.length < 8) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(hexSig, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Extract claim-shaped objects from a parsed RSS item. */
export function extractClaimsFromRssItem(item: RssItem): ClaimExtract[] {
  const claims: ClaimExtract[] = [];
  const rawDate = item.pubDate ? new Date(item.pubDate) : new Date();
  const asserted_at = isNaN(rawDate.getTime()) ? new Date() : rawDate;

  if (item.title) {
    claims.push({
      claim_text: item.title.slice(0, 500),
      evidence_url: item.link || null,
      claim_type: 'fact',
      asserted_at,
    });
  }

  const desc = item.description?.trim();
  if (desc && desc.length > 40) {
    claims.push({
      claim_text: desc.slice(0, 300),
      evidence_url: item.link || null,
      claim_type: 'fact',
      asserted_at,
    });
  }

  return claims;
}

/** Normalize an arbitrary webhook JSON payload into a ClaimExtract. */
export function normalizeWebhookPayload(
  payload: unknown,
  _sourceType: string,
): ClaimExtract {
  const p = payload as Record<string, unknown>;
  const text = (
    (typeof p.text === 'string' ? p.text : null) ??
    (typeof p.message === 'string' ? p.message : null) ??
    (typeof p.title === 'string' ? p.title : null) ??
    (typeof p.content === 'string' ? p.content : null) ??
    JSON.stringify(payload)
  ).slice(0, 500);

  const url =
    (typeof p.url === 'string' ? p.url : null) ??
    (typeof p.link === 'string' ? p.link : null) ??
    null;

  const rawTs = typeof p.timestamp === 'string' || typeof p.timestamp === 'number'
    ? new Date(p.timestamp)
    : new Date();

  return {
    claim_text: text,
    evidence_url: url,
    claim_type: 'fact',
    asserted_at: isNaN(rawTs.getTime()) ? new Date() : rawTs,
  };
}

/** Returns true when error_count has reached the failure threshold. */
export function shouldMarkFailed(errorCount: number): boolean {
  return errorCount >= 5;
}

// ---------------------------------------------------------------------------
// RSS XML parsing — regex-based, no external dependency
// ---------------------------------------------------------------------------

function extractTag(block: string, tag: string): string {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 's');
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 's');
  return (cdataRe.exec(block)?.[1] ?? plainRe.exec(block)?.[1] ?? '').trim();
}

export function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const description = extractTag(block, 'description');
    const pubDate = extractTag(block, 'pubDate');
    if (title || link) items.push({ title, link, description, pubDate });
  }
  return items;
}

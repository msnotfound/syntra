import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { CustomSource, IntelClaim, SourceReliability, Organization } from '@syntra/db';
import { ensureDb } from '@/lib/db';
import { decryptToken } from '@syntra/shared/token-encrypt';
import type { Types } from 'mongoose';

interface RouteParams {
  params: { orgSlug: string; sourceId: string };
}

function validateSignature(body: Buffer, secret: string, header: string): boolean {
  if (!secret) return false;
  const hexSig = header.replace(/^sha256=/, '');
  if (!hexSig || hexSig.length < 8) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(hexSig, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function normalizePayload(payload: unknown, _type: string): { text: string; url: string | null; ts: Date } {
  const p = payload as Record<string, unknown>;
  const text = (
    (typeof p.text === 'string' ? p.text : null) ??
    (typeof p.message === 'string' ? p.message : null) ??
    (typeof p.title === 'string' ? p.title : null) ??
    (typeof p.content === 'string' ? p.content : null) ??
    JSON.stringify(payload)
  ).slice(0, 500);
  const url = (typeof p.url === 'string' ? p.url : null) ?? (typeof p.link === 'string' ? p.link : null);
  const tsRaw = typeof p.timestamp === 'string' || typeof p.timestamp === 'number' ? new Date(p.timestamp) : new Date();
  return { text, url, ts: isNaN(tsRaw.getTime()) ? new Date() : tsRaw };
}

async function ensureSourceReliability(customSourceId: string, sourceName: string): Promise<Types.ObjectId> {
  const slug = `custom-${customSourceId}`;
  const doc = await SourceReliability.findOneAndUpdate(
    { source_id: slug },
    { $setOnInsert: { source_id: slug, source_name: sourceName, admiralty_code: 'F', reliability_pct: 0, last_assessed_at: new Date() } },
    { upsert: true, new: true },
  );
  return doc!._id as Types.ObjectId;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  await ensureDb();

  const org = await Organization.findOne({ slug: params.orgSlug, status: { $ne: 'cancelled' } }).lean();
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const source = await CustomSource.findOne({ _id: params.sourceId, org_id: org._id }).lean();
  if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  if (source.status === 'paused') return NextResponse.json({ error: 'Source paused' }, { status: 403 });

  const rawBody = Buffer.from(await req.arrayBuffer());

  const secretEnc = source.config?.signing_secret_enc;
  if (secretEnc) {
    const secret = decryptToken(secretEnc);
    const sigHeader = req.headers.get('x-hub-signature-256') ?? req.headers.get('x-signature') ?? '';
    if (!validateSignature(rawBody, secret, sigHeader)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { text, url, ts } = normalizePayload(payload, source.source_type);
  const sourceRefId = await ensureSourceReliability(String(source._id), source.name);

  await IntelClaim.create({
    source_id: sourceRefId,
    claim_text: text,
    evidence_url: url,
    asserted_at: ts,
    parent_claim_ids: [],
    claim_type: 'fact',
    alert_id: null,
  });

  await CustomSource.updateOne({ _id: source._id }, { last_polled_at: new Date() });

  return NextResponse.json({ ok: true });
}

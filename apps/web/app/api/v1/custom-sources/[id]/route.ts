import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { CustomSource, IntelClaim, SourceReliability } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { encryptToken } from '@syntra/shared/token-encrypt';

interface RouteParams {
  params: { id: string };
}

function serializeSource(s: Record<string, unknown>) {
  const cfg = (s.config ?? {}) as Record<string, unknown>;
  return {
    id: String(s._id),
    name: s.name,
    source_type: s.source_type,
    status: s.status,
    last_polled_at: s.last_polled_at ?? null,
    error_count: s.error_count ?? 0,
    config: {
      url: cfg.url ?? null,
      auth_type: cfg.auth_type ?? null,
      schedule_cron: cfg.schedule_cron ?? null,
      has_signing_secret: !!cfg.signing_secret_enc,
    },
    created_at: s.created_at,
    updated_at: s.updated_at,
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();

  const source = await CustomSource.findOne({ _id: params.id, org_id: auth.orgId }).lean();
  if (!source) return NextResponse.json(apiError('NOT_FOUND', 'Source not found'), { status: 404 });

  // Attach recent claim count
  const reliabilitySlug = `custom-${String(source._id)}`;
  const reliability = await SourceReliability.findOne({ source_id: reliabilitySlug }).lean();
  const recentClaims = reliability
    ? await IntelClaim.countDocuments({ source_id: reliability._id, created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
    : 0;

  return NextResponse.json(apiResponse({ ...serializeSource(source as Record<string, unknown>), recent_claims_24h: recentClaims }));
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.scopes.includes('write:watchlist')) {
    return NextResponse.json(apiError('FORBIDDEN', 'Insufficient scope'), { status: 403 });
  }
  await ensureDb();

  const source = await CustomSource.findOne({ _id: params.id, org_id: auth.orgId });
  if (!source) return NextResponse.json(apiError('NOT_FOUND', 'Source not found'), { status: 404 });

  const body = await req.json() as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if (typeof body.name === 'string') updates.name = body.name;
  if (body.status && ['active', 'paused'].includes(body.status as string)) {
    updates.status = body.status;
    if (body.status === 'active') updates.error_count = 0;
  }

  const cfg = body.config as Record<string, unknown> | undefined;
  if (cfg) {
    const configUpdates: Record<string, unknown> = { ...source.config };
    if (cfg.url !== undefined) configUpdates.url = cfg.url;
    if (cfg.auth_type !== undefined) configUpdates.auth_type = cfg.auth_type;
    if (cfg.schedule_cron !== undefined) configUpdates.schedule_cron = cfg.schedule_cron;
    if (typeof cfg.auth_token === 'string') configUpdates.auth_token_enc = encryptToken(cfg.auth_token);
    if (typeof cfg.signing_secret === 'string') configUpdates.signing_secret_enc = encryptToken(cfg.signing_secret);
    updates.config = configUpdates;
  }

  Object.assign(source, updates);
  await source.save();

  return NextResponse.json(apiResponse(serializeSource(source.toObject() as unknown as Record<string, unknown>)));
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.scopes.includes('write:watchlist')) {
    return NextResponse.json(apiError('FORBIDDEN', 'Insufficient scope'), { status: 403 });
  }
  await ensureDb();

  const source = await CustomSource.findOneAndDelete({ _id: params.id, org_id: auth.orgId });
  if (!source) return NextResponse.json(apiError('NOT_FOUND', 'Source not found'), { status: 404 });

  return NextResponse.json(apiResponse({ deleted: true }));
}

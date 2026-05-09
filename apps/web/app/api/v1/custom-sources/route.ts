import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { CustomSource } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { encryptToken } from '@syntra/shared/token-encrypt';

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

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();

  const sources = await CustomSource.find({ org_id: auth.orgId }).sort({ created_at: -1 }).lean();
  return NextResponse.json(apiResponse(sources.map(serializeSource)));
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.scopes.includes('write:watchlist')) {
    return NextResponse.json(apiError('FORBIDDEN', 'Insufficient scope'), { status: 403 });
  }
  await ensureDb();

  const body = await req.json() as Record<string, unknown>;
  const { name, source_type, config = {} } = body;
  const cfg = config as Record<string, unknown>;

  if (!name || typeof name !== 'string') {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'name is required'), { status: 400 });
  }
  const validTypes = ['telegram', 'discord', 'rss-private', 'webhook', 'csv-upload'];
  if (!source_type || !validTypes.includes(source_type as string)) {
    return NextResponse.json(apiError('VALIDATION_ERROR', `source_type must be one of: ${validTypes.join(', ')}`), { status: 400 });
  }

  // Encrypt sensitive fields before storage
  const storedConfig: Record<string, unknown> = {
    url: cfg.url ?? null,
    auth_type: cfg.auth_type ?? 'none',
    schedule_cron: cfg.schedule_cron ?? null,
  };
  if (cfg.auth_token && typeof cfg.auth_token === 'string') {
    storedConfig.auth_token_enc = encryptToken(cfg.auth_token);
  }
  if (cfg.signing_secret && typeof cfg.signing_secret === 'string') {
    storedConfig.signing_secret_enc = encryptToken(cfg.signing_secret);
  }

  const source = await CustomSource.create({
    org_id: auth.orgId,
    name,
    source_type,
    config: storedConfig,
  });

  return NextResponse.json(apiResponse(serializeSource(source.toObject())), { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { WatchlistEntity } from '@syntra/db';
import { apiResponse, apiError, WatchlistEntityCreateSchema } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const entities = await WatchlistEntity.find({ org_id: auth.orgId, active: true }).lean();
  return NextResponse.json(apiResponse(entities.map(e => ({ id: String(e._id), type: e.type, name: e.name, latitude: e.latitude, longitude: e.longitude, country_code: e.country_code, region: e.region, metadata: e.metadata, created_at: e.created_at }))));
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.scopes.includes('write:watchlist')) return NextResponse.json(apiError('FORBIDDEN', 'Insufficient scope'), { status: 403 });
  await ensureDb();
  const body = await req.json();
  const parsed = WatchlistEntityCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), { status: 400 });
  const entity = await WatchlistEntity.create({ org_id: auth.orgId, ...parsed.data });
  return NextResponse.json(apiResponse({ id: String(entity._id), ...parsed.data }), { status: 201 });
}

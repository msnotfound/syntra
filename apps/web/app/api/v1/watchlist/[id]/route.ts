import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { WatchlistEntity } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.scopes.includes('write:watchlist')) return NextResponse.json(apiError('FORBIDDEN', 'Insufficient scope'), { status: 403 });
  await ensureDb();
  const body = await req.json();
  const entity = await WatchlistEntity.findOneAndUpdate({ _id: params.id, org_id: auth.orgId }, body, { new: true }).lean();
  if (!entity) return NextResponse.json(apiError('NOT_FOUND', 'Entity not found'), { status: 404 });
  return NextResponse.json(apiResponse({ id: String(entity._id), ...entity }));
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.scopes.includes('write:watchlist')) return NextResponse.json(apiError('FORBIDDEN', 'Insufficient scope'), { status: 403 });
  await ensureDb();
  const entity = await WatchlistEntity.findOneAndUpdate({ _id: params.id, org_id: auth.orgId }, { active: false }, { new: true }).lean();
  if (!entity) return NextResponse.json(apiError('NOT_FOUND', 'Entity not found'), { status: 404 });
  return NextResponse.json(apiResponse({ id: String(entity._id), deleted: true }));
}

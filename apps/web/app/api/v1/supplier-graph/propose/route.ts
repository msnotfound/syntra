import { NextRequest, NextResponse } from 'next/server';
import { Organization, WatchlistEntity } from '@syntra/db';
import { apiError, apiResponse } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { proposeTierOneCounterpartySuppliers } from '../../../../../../worker/src/workers/graph-extract';

export async function POST(req: NextRequest) {
  await ensureDb();

  const body = await req.json().catch(() => null) as { orgSlug?: string; entityId?: string } | null;
  if (!body?.orgSlug || !body.entityId) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'orgSlug and entityId are required'), { status: 400 });
  }

  const org = await Organization.findOne({ slug: body.orgSlug, status: { $ne: 'cancelled' } }).lean();
  if (!org) {
    return NextResponse.json(apiError('NOT_FOUND', 'Organization not found'), { status: 404 });
  }

  const entity = await WatchlistEntity.findOne({
    _id: body.entityId,
    org_id: org._id,
    active: true,
  }).lean();
  if (!entity) {
    return NextResponse.json(apiError('NOT_FOUND', 'Entity not found'), { status: 404 });
  }

  const result = await proposeTierOneCounterpartySuppliers(String(org._id), body.entityId);
  return NextResponse.json(apiResponse(result), { status: 200 });
}

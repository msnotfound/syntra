import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { Asset } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

interface Ctx { params: { id: string } }

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const asset = await Asset.findOne({ _id: params.id, org_id: auth.orgId }).lean();
  if (!asset) return NextResponse.json(apiError('NOT_FOUND', 'Asset not found'), { status: 404 });
  return NextResponse.json(apiResponse({ id: String(asset._id), name: asset.name, kind: asset.kind, location_geo: asset.location_geo, value_usd: asset.value_usd, criticality: asset.criticality, active: asset.active, created_at: asset.created_at, updated_at: asset.updated_at }));
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const body = await req.json();
  const asset = await Asset.findOneAndUpdate({ _id: params.id, org_id: auth.orgId }, body, { new: true }).lean();
  if (!asset) return NextResponse.json(apiError('NOT_FOUND', 'Asset not found'), { status: 404 });
  return NextResponse.json(apiResponse({ id: String(asset._id), name: asset.name, kind: asset.kind, location_geo: asset.location_geo, value_usd: asset.value_usd, criticality: asset.criticality }));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const asset = await Asset.findOneAndUpdate({ _id: params.id, org_id: auth.orgId }, { active: false }, { new: true }).lean();
  if (!asset) return NextResponse.json(apiError('NOT_FOUND', 'Asset not found'), { status: 404 });
  return NextResponse.json(apiResponse({ id: String(asset._id), deleted: true }));
}

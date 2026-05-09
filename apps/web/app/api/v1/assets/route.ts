import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { Asset } from '@syntra/db';
import { apiResponse, apiError, AssetCreateSchema } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const { searchParams } = req.nextUrl;
  const filter: Record<string, unknown> = { org_id: auth.orgId, active: true };
  if (searchParams.get('kind')) filter.kind = searchParams.get('kind');
  if (searchParams.get('criticality')) filter.criticality = searchParams.get('criticality');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const assets = await Asset.find(filter).sort({ created_at: -1 }).limit(limit).lean();
  return NextResponse.json(apiResponse(assets.map(a => ({
    id: String(a._id), name: a.name, kind: a.kind,
    location_geo: a.location_geo, value_usd: a.value_usd,
    criticality: a.criticality, created_at: a.created_at,
  }))));
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const body = await req.json();
  const parsed = AssetCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), { status: 400 });
  const asset = await Asset.create({ org_id: auth.orgId, ...parsed.data });
  return NextResponse.json(apiResponse({ id: String(asset._id), ...parsed.data }), { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { Shipment } from '@syntra/db';
import { apiResponse, apiError, ShipmentCreateSchema } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const { searchParams } = req.nextUrl;
  const filter: Record<string, unknown> = { org_id: auth.orgId, active: true };
  if (searchParams.get('status')) filter.status = searchParams.get('status');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const shipments = await Shipment.find(filter).sort({ created_at: -1 }).limit(limit).lean();
  return NextResponse.json(apiResponse(shipments.map(s => ({
    id: String(s._id), ref: s.ref,
    origin_entity_id: String(s.origin_entity_id),
    destination_entity_id: String(s.destination_entity_id),
    route_polyline: s.route_polyline, status: s.status,
    eta_at: s.eta_at, value_usd: s.value_usd, created_at: s.created_at,
  }))));
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const body = await req.json();
  const parsed = ShipmentCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), { status: 400 });
  const shipment = await Shipment.create({ org_id: auth.orgId, ...parsed.data });
  return NextResponse.json(apiResponse({ id: String(shipment._id), ...parsed.data }), { status: 201 });
}

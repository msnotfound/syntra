import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { Shipment, PurchaseOrder, WatchlistEntity } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

interface Ctx { params: { id: string } }

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const shipment = await Shipment.findOne({ _id: params.id, org_id: auth.orgId }).lean();
  if (!shipment) return NextResponse.json(apiError('NOT_FOUND', 'Shipment not found'), { status: 404 });

  // Cross-link: fetch origin and destination entities + related POs
  const [origin, destination, relatedPOs] = await Promise.all([
    WatchlistEntity.findById(shipment.origin_entity_id).lean(),
    WatchlistEntity.findById(shipment.destination_entity_id).lean(),
    PurchaseOrder.find({ org_id: auth.orgId, supplier_entity_id: shipment.origin_entity_id, active: true }).limit(20).lean(),
  ]);

  return NextResponse.json(apiResponse({
    id: String(shipment._id), ref: shipment.ref,
    origin_entity_id: String(shipment.origin_entity_id),
    destination_entity_id: String(shipment.destination_entity_id),
    route_polyline: shipment.route_polyline, status: shipment.status,
    eta_at: shipment.eta_at, value_usd: shipment.value_usd,
    created_at: shipment.created_at, updated_at: shipment.updated_at,
    _links: {
      origin: origin ? { id: String(origin._id), name: origin.name, type: origin.type } : null,
      destination: destination ? { id: String(destination._id), name: destination.name, type: destination.type } : null,
      purchase_orders: relatedPOs.map(p => ({ id: String(p._id), po_number: p.po_number, status: p.status, total_usd: p.total_usd })),
    },
  }));
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const body = await req.json();
  const shipment = await Shipment.findOneAndUpdate({ _id: params.id, org_id: auth.orgId }, body, { new: true }).lean();
  if (!shipment) return NextResponse.json(apiError('NOT_FOUND', 'Shipment not found'), { status: 404 });
  return NextResponse.json(apiResponse({ id: String(shipment._id), ref: shipment.ref, status: shipment.status, eta_at: shipment.eta_at }));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const shipment = await Shipment.findOneAndUpdate({ _id: params.id, org_id: auth.orgId }, { active: false }, { new: true }).lean();
  if (!shipment) return NextResponse.json(apiError('NOT_FOUND', 'Shipment not found'), { status: 404 });
  return NextResponse.json(apiResponse({ id: String(shipment._id), deleted: true }));
}

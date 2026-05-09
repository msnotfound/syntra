import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { PurchaseOrder, Counterparty, WatchlistEntity } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

interface Ctx { params: { id: string } }

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const po = await PurchaseOrder.findOne({ _id: params.id, org_id: auth.orgId }).lean();
  if (!po) return NextResponse.json(apiError('NOT_FOUND', 'Purchase order not found'), { status: 404 });

  // Cross-link: fetch supplier entity + counterparty record
  const [supplier, counterparty] = await Promise.all([
    WatchlistEntity.findById(po.supplier_entity_id).lean(),
    Counterparty.findOne({ org_id: auth.orgId, entity_id: po.supplier_entity_id, active: true }).lean(),
  ]);

  return NextResponse.json(apiResponse({
    id: String(po._id), po_number: po.po_number,
    supplier_entity_id: String(po.supplier_entity_id),
    items: po.items, total_usd: po.total_usd, status: po.status,
    due_at: po.due_at, created_at: po.created_at, updated_at: po.updated_at,
    _links: {
      supplier: supplier ? { id: String(supplier._id), name: supplier.name, type: supplier.type } : null,
      counterparty: counterparty ? { id: String(counterparty._id), role: counterparty.role, risk_score: counterparty.risk_score } : null,
    },
  }));
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const body = await req.json();
  const po = await PurchaseOrder.findOneAndUpdate({ _id: params.id, org_id: auth.orgId }, body, { new: true }).lean();
  if (!po) return NextResponse.json(apiError('NOT_FOUND', 'Purchase order not found'), { status: 404 });
  return NextResponse.json(apiResponse({ id: String(po._id), po_number: po.po_number, status: po.status }));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const po = await PurchaseOrder.findOneAndUpdate({ _id: params.id, org_id: auth.orgId }, { active: false }, { new: true }).lean();
  if (!po) return NextResponse.json(apiError('NOT_FOUND', 'Purchase order not found'), { status: 404 });
  return NextResponse.json(apiResponse({ id: String(po._id), deleted: true }));
}

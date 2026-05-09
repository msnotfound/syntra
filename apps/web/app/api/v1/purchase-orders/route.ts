import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { PurchaseOrder } from '@syntra/db';
import { apiResponse, apiError, PurchaseOrderCreateSchema } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const { searchParams } = req.nextUrl;
  const filter: Record<string, unknown> = { org_id: auth.orgId, active: true };
  if (searchParams.get('status')) filter.status = searchParams.get('status');
  if (searchParams.get('supplier_entity_id')) filter.supplier_entity_id = searchParams.get('supplier_entity_id');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const pos = await PurchaseOrder.find(filter).sort({ created_at: -1 }).limit(limit).lean();
  return NextResponse.json(apiResponse(pos.map(p => ({
    id: String(p._id), po_number: p.po_number,
    supplier_entity_id: String(p.supplier_entity_id),
    items: p.items, total_usd: p.total_usd, status: p.status,
    due_at: p.due_at, created_at: p.created_at,
  }))));
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const body = await req.json();
  const parsed = PurchaseOrderCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), { status: 400 });
  const po = await PurchaseOrder.create({ org_id: auth.orgId, ...parsed.data });
  return NextResponse.json(apiResponse({ id: String(po._id), ...parsed.data }), { status: 201 });
}

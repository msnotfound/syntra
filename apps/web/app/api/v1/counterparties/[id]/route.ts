import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { Counterparty, Contract, WatchlistEntity } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

interface Ctx { params: { id: string } }

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const cp = await Counterparty.findOne({ _id: params.id, org_id: auth.orgId }).lean();
  if (!cp) return NextResponse.json(apiError('NOT_FOUND', 'Counterparty not found'), { status: 404 });

  // Cross-link: entity info + all contracts for this counterparty
  const [entity, contracts] = await Promise.all([
    WatchlistEntity.findById(cp.entity_id).lean(),
    Contract.find({ org_id: auth.orgId, counterparty_id: params.id, active: true }).lean(),
  ]);

  return NextResponse.json(apiResponse({
    id: String(cp._id), entity_id: String(cp.entity_id), role: cp.role,
    risk_score: cp.risk_score, relationship_value_usd: cp.relationship_value_usd,
    contract_id: cp.contract_id ? String(cp.contract_id) : null,
    created_at: cp.created_at, updated_at: cp.updated_at,
    _links: {
      entity: entity ? { id: String(entity._id), name: entity.name, type: entity.type, country_code: entity.country_code } : null,
      contracts: contracts.map(c => ({ id: String(c._id), ref: c.ref, type: c.type, value_usd: c.value_usd, expires_at: c.expires_at })),
    },
  }));
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const body = await req.json();
  const cp = await Counterparty.findOneAndUpdate({ _id: params.id, org_id: auth.orgId }, body, { new: true }).lean();
  if (!cp) return NextResponse.json(apiError('NOT_FOUND', 'Counterparty not found'), { status: 404 });
  return NextResponse.json(apiResponse({ id: String(cp._id), role: cp.role, risk_score: cp.risk_score }));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const cp = await Counterparty.findOneAndUpdate({ _id: params.id, org_id: auth.orgId }, { active: false }, { new: true }).lean();
  if (!cp) return NextResponse.json(apiError('NOT_FOUND', 'Counterparty not found'), { status: 404 });
  return NextResponse.json(apiResponse({ id: String(cp._id), deleted: true }));
}

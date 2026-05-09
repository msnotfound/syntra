import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { Counterparty } from '@syntra/db';
import { apiResponse, apiError, CounterpartyCreateSchema } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const { searchParams } = req.nextUrl;
  const filter: Record<string, unknown> = { org_id: auth.orgId, active: true };
  if (searchParams.get('role')) filter.role = searchParams.get('role');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const cps = await Counterparty.find(filter).sort({ risk_score: -1 }).limit(limit).lean();
  return NextResponse.json(apiResponse(cps.map(c => ({
    id: String(c._id), entity_id: String(c.entity_id), role: c.role,
    risk_score: c.risk_score, relationship_value_usd: c.relationship_value_usd,
    contract_id: c.contract_id ? String(c.contract_id) : null, created_at: c.created_at,
  }))));
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const body = await req.json();
  const parsed = CounterpartyCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), { status: 400 });
  const cp = await Counterparty.create({ org_id: auth.orgId, ...parsed.data });
  return NextResponse.json(apiResponse({ id: String(cp._id), ...parsed.data }), { status: 201 });
}

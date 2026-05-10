import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { Contract } from '@syntra/db';
import { apiResponse, apiError, ContractCreateSchema } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const { searchParams } = req.nextUrl;
  const filter: Record<string, unknown> = { org_id: auth.orgId, active: true };
  if (searchParams.get('counterparty_id')) filter.counterparty_id = searchParams.get('counterparty_id');
  if (searchParams.get('type')) filter.type = searchParams.get('type');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const contracts = await Contract.find(filter).sort({ created_at: -1 }).limit(limit).lean();
  return NextResponse.json(apiResponse(contracts.map(c => ({
    id: String(c._id), counterparty_id: String(c.counterparty_id),
    ref: c.ref, type: c.type, value_usd: c.value_usd,
    expires_at: c.expires_at, terms_summary: c.terms_summary,
    force_majeure_clauses: c.force_majeure_clauses,
    source_doc_url: c.source_doc_url,
    source_doc_hash: c.source_doc_hash,
    extraction_run_id: c.extraction_run_id,
    extraction_confidence_pct: c.extraction_confidence_pct,
    extracted_at: c.extracted_at,
    extracted: c.extracted,
    created_at: c.created_at,
  }))));
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const body = await req.json();
  const parsed = ContractCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), { status: 400 });
  // Ensure counterparty belongs to this org
  const cp = await (await import('@syntra/db')).Counterparty.findOne({ _id: parsed.data.counterparty_id, org_id: auth.orgId }).lean();
  if (!cp) return NextResponse.json(apiError('NOT_FOUND', 'Counterparty not found'), { status: 404 });
  const contract = await Contract.create({ org_id: auth.orgId, ...parsed.data });
  return NextResponse.json(apiResponse({ id: String(contract._id), ...parsed.data }), { status: 201 });
}

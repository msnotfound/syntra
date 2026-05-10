import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { Contract, Counterparty } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

interface Ctx { params: { id: string } }

export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const contract = await Contract.findOne({ _id: params.id, org_id: auth.orgId }).lean();
  if (!contract) return NextResponse.json(apiError('NOT_FOUND', 'Contract not found'), { status: 404 });

  // Cross-link: fetch counterparty
  const counterparty = await Counterparty.findById(contract.counterparty_id).lean();

  return NextResponse.json(apiResponse({
    id: String(contract._id), counterparty_id: String(contract.counterparty_id),
    ref: contract.ref, type: contract.type, value_usd: contract.value_usd,
    expires_at: contract.expires_at, terms_summary: contract.terms_summary,
    force_majeure_clauses: contract.force_majeure_clauses,
    source_doc_url: contract.source_doc_url,
    source_doc_hash: contract.source_doc_hash,
    extraction_run_id: contract.extraction_run_id,
    extraction_confidence_pct: contract.extraction_confidence_pct,
    extracted_at: contract.extracted_at,
    extracted: contract.extracted,
    created_at: contract.created_at, updated_at: contract.updated_at,
    _links: {
      counterparty: counterparty ? { id: String(counterparty._id), role: counterparty.role, risk_score: counterparty.risk_score, entity_id: String(counterparty.entity_id) } : null,
    },
  }));
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const body = await req.json();
  const contract = await Contract.findOneAndUpdate({ _id: params.id, org_id: auth.orgId }, body, { new: true }).lean();
  if (!contract) return NextResponse.json(apiError('NOT_FOUND', 'Contract not found'), { status: 404 });
  return NextResponse.json(apiResponse({ id: String(contract._id), ref: contract.ref, type: contract.type }));
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const contract = await Contract.findOneAndUpdate({ _id: params.id, org_id: auth.orgId }, { active: false }, { new: true }).lean();
  if (!contract) return NextResponse.json(apiError('NOT_FOUND', 'Contract not found'), { status: 404 });
  return NextResponse.json(apiResponse({ id: String(contract._id), deleted: true }));
}

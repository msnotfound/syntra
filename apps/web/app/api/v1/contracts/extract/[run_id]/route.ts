import { NextRequest, NextResponse } from 'next/server';
import { Contract, ContractExtractionRun, Organization } from '@syntra/db';
import { apiError, apiResponse } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { requireAuth } from '@/lib/auth';

interface Ctx { params: { run_id: string } }

export async function GET(req: NextRequest, { params }: Ctx) {
  await ensureDb();
  const auth = await resolveContractExtractAuth(req);
  if (auth instanceof NextResponse) return auth;

  const run = await ContractExtractionRun.findOne({ _id: params.run_id, org_id: auth.orgId }).lean();
  if (!run) return NextResponse.json(apiError('NOT_FOUND', 'Extraction run not found'), { status: 404 });

  const contract = run.contract_id
    ? await Contract.findOne({ _id: run.contract_id, org_id: auth.orgId }).lean()
    : null;

  return NextResponse.json(apiResponse({
    extraction_run_id: String(run._id),
    status: run.status,
    success: run.success,
    error: run.error,
    input_doc_hash: run.input_doc_hash,
    llm_tokens_used: run.llm_tokens_used,
    latency_ms: run.latency_ms,
    started_at: run.started_at,
    completed_at: run.completed_at,
    result: contract ? {
      contract_id: String(contract._id),
      ref: contract.ref,
      extracted: contract.extracted,
      extraction_confidence_pct: contract.extraction_confidence_pct,
      extracted_at: contract.extracted_at,
    } : null,
  }));
}

async function resolveContractExtractAuth(req: NextRequest): Promise<{ orgId: string } | NextResponse> {
  if (req.headers.get('authorization')) {
    const apiAuth = await authenticateApiKey(req);
    if (apiAuth instanceof NextResponse) return apiAuth;
    return { orgId: apiAuth.orgId };
  }

  try {
    const session = await requireAuth();
    if (session.orgId && /^[a-f0-9]{24}$/i.test(session.orgId)) return { orgId: session.orgId };
    const org = await Organization.findOne({ slug: session.orgSlug, status: { $ne: 'cancelled' } }).lean();
    if (!org) return NextResponse.json(apiError('FORBIDDEN', 'Organization not found'), { status: 403 });
    return { orgId: String(org._id) };
  } catch {
    return NextResponse.json(apiError('UNAUTHORIZED', 'Unauthorized'), { status: 401 });
  }
}

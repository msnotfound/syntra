import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ContractExtractionRun, Organization } from '@syntra/db';
import { apiError, apiResponse } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { requireAuth } from '@/lib/auth';
import { getContractExtractQueue } from '../../../../../../worker/src/workers/contract-extract';

const ExtractRequestSchema = z.object({
  doc_url: z.string().url(),
  contract_id: z.string().length(24).optional(),
  force: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  await ensureDb();
  const auth = await resolveContractExtractAuth(req);
  if (auth instanceof NextResponse) return auth;

  const parsed = ExtractRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues), { status: 400 });
  }

  const run = await ContractExtractionRun.create({
    org_id: auth.orgId,
    doc_url: parsed.data.doc_url,
    contract_id: parsed.data.contract_id ?? null,
    status: 'queued',
    started_at: new Date(),
  });

  await getContractExtractQueue().add(
    'contract-extract',
    {
      org_id: auth.orgId,
      doc_url: parsed.data.doc_url,
      contract_id: parsed.data.contract_id,
      force: parsed.data.force ?? false,
      extraction_run_id: String(run._id),
    },
    { jobId: `contract_extract:${String(run._id)}` },
  );

  return NextResponse.json(apiResponse({ extraction_run_id: String(run._id) }), { status: 202 });
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

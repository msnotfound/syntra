import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { InsurancePolicy } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

interface RouteContext { params: { id: string } }

const PatchSchema = z.object({
  insurer_name: z.string().min(1).max(200).optional(),
  coverage_type: z.enum(['marine', 'cargo', 'trade_credit', 'political_risk', 'other']).optional(),
  max_payout_usd: z.number().positive().optional(),
  deductible_usd: z.number().min(0).optional(),
  expires_at: z.string().datetime().optional(),
}).strict();

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await requireAuth().catch(() => null);
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });
  await ensureDb();

  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.expires_at) {
    update.expires_at = new Date(parsed.data.expires_at);
  }

  const policy = await InsurancePolicy.findOneAndUpdate(
    { _id: params.id, org_id: session.orgId },
    { $set: update },
    { new: true },
  ).lean();

  if (!policy) {
    return NextResponse.json(apiError('NOT_FOUND', 'Policy not found'), { status: 404 });
  }

  return NextResponse.json(apiResponse({
    id: String(policy._id),
    policy_id: policy.policy_id,
    insurer_name: policy.insurer_name,
    coverage_type: policy.coverage_type,
    max_payout_usd: policy.max_payout_usd,
    deductible_usd: policy.deductible_usd,
    expires_at: policy.expires_at,
    updated_at: policy.updated_at,
  }));
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await requireAuth().catch(() => null);
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });
  await ensureDb();

  const result = await InsurancePolicy.deleteOne({ _id: params.id, org_id: session.orgId });
  if (result.deletedCount === 0) {
    return NextResponse.json(apiError('NOT_FOUND', 'Policy not found'), { status: 404 });
  }

  return NextResponse.json(apiResponse({ deleted: true }));
}

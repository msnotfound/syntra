import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { InsurancePolicy } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

const CreateSchema = z.object({
  policy_id: z.string().min(1).max(64),
  insurer_name: z.string().min(1).max(200),
  coverage_type: z.enum(['marine', 'cargo', 'trade_credit', 'political_risk', 'other']),
  max_payout_usd: z.number().positive(),
  aggregate_limit_usd: z.number().positive().optional(),
  deductible_usd: z.number().min(0).default(0),
  expires_at: z.string().datetime(),
});

export async function GET(_req: NextRequest) {
  const session = await requireAuth().catch(() => null);
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });
  await ensureDb();

  const policies = await InsurancePolicy.find({ org_id: session.orgId })
    .sort({ expires_at: 1 })
    .lean();

  return NextResponse.json(apiResponse(
    policies.map(p => ({
      id: String(p._id),
      policy_id: p.policy_id,
      insurer_name: p.insurer_name,
      coverage_type: p.coverage_type,
      max_payout_usd: p.max_payout_usd,
      aggregate_limit_usd: p.aggregate_limit_usd,
      sub_limits: p.sub_limits,
      exclusions: p.exclusions,
      claims_history: p.claims_history,
      deductible_usd: p.deductible_usd,
      expires_at: p.expires_at,
      created_at: p.created_at,
    })),
  ));
}

export async function POST(req: NextRequest) {
  const session = await requireAuth().catch(() => null);
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });
  await ensureDb();

  const body = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
      { status: 400 },
    );
  }

  const existing = await InsurancePolicy.findOne({
    org_id: session.orgId,
    policy_id: parsed.data.policy_id,
  }).lean();
  if (existing) {
    return NextResponse.json(
      apiError('CONFLICT', 'Policy ID already exists for this org'),
      { status: 409 },
    );
  }

  const policy = await InsurancePolicy.create({
    org_id: session.orgId,
    ...parsed.data,
    expires_at: new Date(parsed.data.expires_at),
  });

  return NextResponse.json(
    apiResponse({
      id: String(policy._id),
      policy_id: policy.policy_id,
      insurer_name: policy.insurer_name,
      coverage_type: policy.coverage_type,
      max_payout_usd: policy.max_payout_usd,
      aggregate_limit_usd: policy.aggregate_limit_usd,
      sub_limits: policy.sub_limits,
      exclusions: policy.exclusions,
      claims_history: policy.claims_history,
      deductible_usd: policy.deductible_usd,
      expires_at: policy.expires_at,
    }),
    { status: 201 },
  );
}

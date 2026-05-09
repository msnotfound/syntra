import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { Scenario, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { z } from 'zod';

const HypothesisEventSchema = z.object({
  type:     z.enum(['physical_risk', 'sanctions_match', 'compliance']),
  geo:      z.string().min(1),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
});

const CreateSchema = z.object({
  name:               z.string().min(1).max(200),
  description:        z.string().default(''),
  hypothesis_events:  z.array(HypothesisEventSchema).default([]),
});

export async function GET(req: NextRequest) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const { searchParams } = req.nextUrl;
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1'));
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
  const skip  = (page - 1) * limit;

  const [scenarios, total] = await Promise.all([
    Scenario.find({ org_id: user.org_id }).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Scenario.countDocuments({ org_id: user.org_id }),
  ]);

  return NextResponse.json(apiResponse({
    scenarios: scenarios.map(s => ({
      id:                     String(s._id),
      name:                   s.name,
      description:            s.description,
      hypothesis_events:      s.hypothesis_events,
      affected_entity_count:  s.affected_entity_ids.length,
      computed_var_total_usd: s.computed_var_total_usd,
      computed_at:            s.computed_at,
      created_by:             String(s.created_by),
      created_at:             s.created_at,
      updated_at:             s.updated_at,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }));
}

export async function POST(req: NextRequest) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'), { status: 400 });
  }

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const scenario = await Scenario.create({
    org_id:             user.org_id,
    name:               parsed.data.name,
    description:        parsed.data.description,
    hypothesis_events:  parsed.data.hypothesis_events,
    affected_entity_ids: [],
    computed_var_total_usd: null,
    computed_at:        null,
    created_by:         user._id,
  });

  return NextResponse.json(apiResponse({
    id:               String(scenario._id),
    name:             scenario.name,
    description:      scenario.description,
    hypothesis_events: scenario.hypothesis_events,
    computed_var_total_usd: null,
    computed_at:      null,
    created_at:       scenario.created_at,
  }), { status: 201 });
}

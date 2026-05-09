import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { Scenario, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { z } from 'zod';
import mongoose from 'mongoose';

interface RouteContext { params: { id: string } }

const ObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const HypothesisEventSchema = z.object({
  type:     z.enum(['physical_risk', 'sanctions_match', 'compliance']),
  geo:      z.string().min(1),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
});

const PatchSchema = z.object({
  name:              z.string().min(1).max(200).optional(),
  description:       z.string().optional(),
  hypothesis_events: z.array(HypothesisEventSchema).optional(),
});

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  if (!ObjectIdSchema.safeParse(params.id).success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid id'), { status: 400 });
  }

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const scenario = await Scenario.findOne({ _id: params.id, org_id: user.org_id }).lean();
  if (!scenario) return NextResponse.json(apiError('NOT_FOUND', 'Scenario not found'), { status: 404 });

  return NextResponse.json(apiResponse({
    id:                     String(scenario._id),
    name:                   scenario.name,
    description:            scenario.description,
    hypothesis_events:      scenario.hypothesis_events,
    affected_entity_ids:    scenario.affected_entity_ids.map(String),
    computed_var_total_usd: scenario.computed_var_total_usd,
    computed_at:            scenario.computed_at,
    created_by:             String(scenario.created_by),
    created_at:             scenario.created_at,
    updated_at:             scenario.updated_at,
  }));
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  if (!ObjectIdSchema.safeParse(params.id).success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid id'), { status: 400 });
  }

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'), { status: 400 });
  }

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const update: Record<string, unknown> = {};
  if (parsed.data.name              !== undefined) update.name              = parsed.data.name;
  if (parsed.data.description       !== undefined) update.description       = parsed.data.description;
  if (parsed.data.hypothesis_events !== undefined) {
    update.hypothesis_events      = parsed.data.hypothesis_events;
    // Invalidate prior compute when events change
    update.computed_var_total_usd = null;
    update.computed_at            = null;
    update.affected_entity_ids    = [];
  }

  const scenario = await Scenario.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(params.id), org_id: user.org_id },
    { $set: update },
    { new: true },
  ).lean();
  if (!scenario) return NextResponse.json(apiError('NOT_FOUND', 'Scenario not found'), { status: 404 });

  return NextResponse.json(apiResponse({
    id:                     String(scenario._id),
    name:                   scenario.name,
    description:            scenario.description,
    hypothesis_events:      scenario.hypothesis_events,
    affected_entity_ids:    scenario.affected_entity_ids.map(String),
    computed_var_total_usd: scenario.computed_var_total_usd,
    computed_at:            scenario.computed_at,
    updated_at:             scenario.updated_at,
  }));
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  if (!ObjectIdSchema.safeParse(params.id).success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid id'), { status: 400 });
  }

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const result = await Scenario.deleteOne({ _id: params.id, org_id: user.org_id });
  if (result.deletedCount === 0) {
    return NextResponse.json(apiError('NOT_FOUND', 'Scenario not found'), { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}

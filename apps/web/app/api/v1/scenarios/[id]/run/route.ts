import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { Scenario, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { z } from 'zod';
import { Types } from 'mongoose';
import { computeScenario } from '@syntra/db/utils/scenario-compute.js';

interface RouteContext { params: { id: string } }

const ObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

export async function POST(_req: NextRequest, { params }: RouteContext) {
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

  if (scenario.hypothesis_events.length === 0) {
    return NextResponse.json(
      apiError('VALIDATION_ERROR', 'Scenario has no hypothesis events to compute'),
      { status: 400 },
    );
  }

  const result = await computeScenario(scenario.org_id, scenario.hypothesis_events);
  const now = new Date();

  const updated = await Scenario.findOneAndUpdate(
    { _id: scenario._id },
    {
      $set: {
        affected_entity_ids:    result.affected_entity_ids.map(id => new Types.ObjectId(id)),
        computed_var_total_usd: result.computed_var_total_usd,
        computed_at:            now,
      },
    },
    { new: true },
  ).lean();

  return NextResponse.json(apiResponse({
    id:                     String(scenario._id),
    computed_var_total_usd: result.computed_var_total_usd,
    affected_entity_ids:    result.affected_entity_ids,
    entity_var_map:         result.entity_var_map,
    computed_at:            now,
    updated_at:             updated?.updated_at,
  }));
}

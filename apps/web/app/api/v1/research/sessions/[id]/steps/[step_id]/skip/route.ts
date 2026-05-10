import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { ensureDb } from '@/lib/db';
import { ResearchSession, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; step_id: string } },
) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const researchSession = await ResearchSession.findOne({
    _id: params.id,
    org_id: user.org_id,
  }).lean();
  if (!researchSession) return NextResponse.json(apiError('NOT_FOUND', 'Session not found'), { status: 404 });

  const step = researchSession.plan_steps.find(s => s.step_id === params.step_id);
  if (!step) return NextResponse.json(apiError('NOT_FOUND', 'Step not found'), { status: 404 });

  if (step.status === 'running') {
    return NextResponse.json(apiError('CONFLICT', 'Cannot skip a running step'), { status: 409 });
  }
  if (step.kind === 'sub_question') {
    return NextResponse.json(apiError('CONFLICT', 'Cannot skip the planning step'), { status: 409 });
  }

  await ResearchSession.updateOne(
    { _id: params.id },
    { $set: { 'plan_steps.$[step].status': 'skipped', 'plan_steps.$[step].updated_at': new Date() } },
    { arrayFilters: [{ 'step.step_id': params.step_id }] },
  );

  return NextResponse.json(apiResponse({ skipped: true }));
}

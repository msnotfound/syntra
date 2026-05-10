import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { ensureDb } from '@/lib/db';
import { ResearchSession, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { getResearchRunnerQueue } from '../../../../../../../../../../worker/src/workers/research-runner';

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
    return NextResponse.json(apiResponse({ queued: false, reason: 'already_running' }));
  }
  if (step.status === 'done') {
    return NextResponse.json(apiResponse({ queued: false, reason: 'already_done' }));
  }
  if (step.status === 'skipped') {
    return NextResponse.json(apiError('CONFLICT', 'Step is skipped; unskip before running'), { status: 409 });
  }

  try {
    const queue = getResearchRunnerQueue();
    await queue.add('run-step', { session_id: params.id, step_id: params.step_id }, {
      jobId: `${params.id}:${params.step_id}`,
      removeOnComplete: 100,
    });
  } catch {
    // Queue unavailable — run inline (sandbox/test mode)
    void import('../../../../../../../../../../worker/src/workers/research-runner');
    return NextResponse.json(apiResponse({ queued: false, reason: 'worker_unavailable' }));
  }

  return NextResponse.json(apiResponse({ queued: true }));
}

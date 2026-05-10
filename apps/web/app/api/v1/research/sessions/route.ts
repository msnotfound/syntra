import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID as uuidv4 } from 'crypto';
import { getServerAuth } from '@/lib/auth';
import { ensureDb } from '@/lib/db';
import { ResearchSession, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { getResearchRunnerQueue } from '../../../../../../worker/src/workers/research-runner';

const CreateSchema = z.object({
  question: z.string().min(10).max(500),
});

export async function POST(req: NextRequest) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'), { status: 400 });
  }

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const stepId = uuidv4();
  const researchSession = await ResearchSession.create({
    org_id: user.org_id,
    user_id: session.userId,
    question: parsed.data.question,
    status: 'planning',
    plan_steps: [{
      step_id: stepId,
      order: 0,
      kind: 'sub_question',
      title: 'Break question into sub-questions',
      description: 'The AI will decompose your research question into 3-6 focused sub-questions.',
      status: 'accepted',
      prompt: null,
      output: null,
      evidence_claim_ids: [],
    }],
    final_report_id: null,
  });

  // Auto-enqueue the sub_question step
  try {
    const queue = getResearchRunnerQueue();
    await queue.add('run-step', { session_id: String(researchSession._id), step_id: stepId });
  } catch {
    // Worker not available (sandbox) — step stays 'accepted', user can re-run via API
  }

  return NextResponse.json(apiResponse({ session: researchSession }), { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 100);

  const sessions = await ResearchSession.find({ org_id: user.org_id })
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json(apiResponse({ sessions }));
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerAuth } from '@/lib/auth';
import { ensureDb } from '@/lib/db';
import { ResearchSession, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';

const EditSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  prompt: z.string().max(1000).optional(),
}).refine(d => d.title !== undefined || d.description !== undefined || d.prompt !== undefined, {
  message: 'At least one of title, description, or prompt must be provided',
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; step_id: string } },
) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = EditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'), { status: 400 });
  }

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
    return NextResponse.json(apiError('CONFLICT', 'Cannot edit a running step'), { status: 409 });
  }

  const setFields: Record<string, unknown> = {
    'plan_steps.$[step].status': 'edited',
    'plan_steps.$[step].updated_at': new Date(),
  };
  if (parsed.data.title !== undefined) setFields['plan_steps.$[step].title'] = parsed.data.title;
  if (parsed.data.description !== undefined) setFields['plan_steps.$[step].description'] = parsed.data.description;
  if (parsed.data.prompt !== undefined) setFields['plan_steps.$[step].prompt'] = parsed.data.prompt;

  await ResearchSession.updateOne(
    { _id: params.id },
    { $set: setFields },
    { arrayFilters: [{ 'step.step_id': params.step_id }] },
  );

  const updated = await ResearchSession.findOne({ _id: params.id, org_id: user.org_id }).lean();
  const updatedStep = updated?.plan_steps.find(s => s.step_id === params.step_id);

  return NextResponse.json(apiResponse({ step: updatedStep }));
}

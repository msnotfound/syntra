import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { ensureDb } from '@/lib/db';
import { ResearchSession, ResearchReport, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { finalizeResearchSession } from '../../../../../../../../worker/src/workers/research-runner';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
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

  if (researchSession.status === 'finalized') {
    const report = await ResearchReport.findById(researchSession.final_report_id).lean();
    return NextResponse.json(apiResponse({ report, already_finalized: true }));
  }

  if (researchSession.status === 'cancelled') {
    return NextResponse.json(apiError('CONFLICT', 'Session is cancelled'), { status: 409 });
  }

  const hasSynthesizeResults = researchSession.plan_steps.some(
    s => s.kind === 'synthesize' && s.status === 'done',
  );
  if (!hasSynthesizeResults) {
    return NextResponse.json(
      apiError('CONFLICT', 'No completed synthesis steps. Run at least one synthesize step before finalizing.'),
      { status: 409 },
    );
  }

  const reportId = await finalizeResearchSession(params.id, session.userId);
  const report = await ResearchReport.findById(reportId).lean();

  return NextResponse.json(apiResponse({ report }), { status: 201 });
}

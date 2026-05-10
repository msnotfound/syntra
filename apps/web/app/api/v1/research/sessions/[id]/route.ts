import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { ensureDb } from '@/lib/db';
import { ResearchSession, ResearchReport, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';

export async function GET(
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

  let report = null;
  if (researchSession.final_report_id) {
    report = await ResearchReport.findById(researchSession.final_report_id).lean();
  }

  return NextResponse.json(apiResponse({ session: researchSession, report }));
}

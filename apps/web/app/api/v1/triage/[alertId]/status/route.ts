import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { Alert, User, Decision } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { z } from 'zod';

const BodySchema = z.object({
  status: z.enum(['open', 'triaged', 'closed']),
});

export async function POST(req: NextRequest, { params }: { params: { alertId: string } }) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'), { status: 400 });
  }

  await ensureDb();

  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const alert = await Alert.findOneAndUpdate(
    { _id: params.alertId, org_id: user.org_id },
    { status: parsed.data.status },
    { new: true },
  ).lean();

  if (!alert) return NextResponse.json(apiError('NOT_FOUND', 'Alert not found'), { status: 404 });

  // Append decision record for status change (fire-and-forget, non-blocking).
  const decisionType = parsed.data.status === 'closed' ? 'closed' : 'acknowledged';
  Decision.create({
    org_id: user.org_id,
    alert_id: alert._id,
    user_id: user._id,
    decision_type: decisionType,
    decision_text: `Status changed to ${parsed.data.status}`,
    justification: '',
    made_at: new Date(),
  }).catch(err => console.error('[decision-record] status write failed', err));

  return NextResponse.json(apiResponse({
    alert_id: String(alert._id),
    status: alert.status,
    updated_at: new Date(),
  }));
}

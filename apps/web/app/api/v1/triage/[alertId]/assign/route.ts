import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { Alert, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { z } from 'zod';

const ObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const BodySchema = z.object({
  assignee_user_id: ObjectIdSchema.nullable(),
});

export async function POST(req: NextRequest, { params }: { params: { alertId: string } }) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'), { status: 400 });
  }

  await ensureDb();

  const requestingUser = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!requestingUser) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const { assignee_user_id } = parsed.data;

  if (assignee_user_id !== null) {
    const assignee = await User.findOne({ _id: assignee_user_id, org_id: requestingUser.org_id }).lean();
    if (!assignee) return NextResponse.json(apiError('NOT_FOUND', 'Assignee not found in this org'), { status: 404 });
  }

  const now = new Date();
  const alert = await Alert.findOneAndUpdate(
    { _id: params.alertId, org_id: requestingUser.org_id },
    { assignee_user_id: assignee_user_id ?? null },
    { new: true },
  ).lean();

  if (!alert) return NextResponse.json(apiError('NOT_FOUND', 'Alert not found'), { status: 404 });

  return NextResponse.json(apiResponse({
    alert_id: String(alert._id),
    assignee_user_id: assignee_user_id,
    updated_at: now,
  }));
}

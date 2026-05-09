import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { WarRoom, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { z } from 'zod';

const PatchSchema = z.object({
  status: z.enum(['open', 'closed']),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const room = await WarRoom.findOne({ _id: params.id, org_id: user.org_id }).lean();
  if (!room) return NextResponse.json(apiError('NOT_FOUND', 'War room not found'), { status: 404 });

  return NextResponse.json(apiResponse({
    id:           String(room._id),
    name:         room.name,
    status:       room.status,
    alert_id:     room.alert_id ? String(room.alert_id) : null,
    created_by:   String(room.created_by),
    participants: room.participants.map(String),
    created_at:   room.created_at,
  }));
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'), { status: 400 });
  }

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const room = await WarRoom.findOneAndUpdate(
    { _id: params.id, org_id: user.org_id },
    { status: parsed.data.status },
    { new: true },
  ).lean();

  if (!room) return NextResponse.json(apiError('NOT_FOUND', 'War room not found'), { status: 404 });

  return NextResponse.json(apiResponse({
    id:     String(room._id),
    status: room.status,
  }));
}

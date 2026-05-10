import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { WarRoom, WarRoomMessage, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { z } from 'zod';

const PostSchema = z.object({
  question: z.string().min(1).max(500),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  const parsed = PostSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'), { status: 400 });
  }

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const room = await WarRoom.findOne({ _id: params.id, org_id: user.org_id }).lean();
  if (!room) return NextResponse.json(apiError('NOT_FOUND', 'War room not found'), { status: 404 });
  if (room.status === 'closed') {
    return NextResponse.json(apiError('FORBIDDEN', 'War room is closed'), { status: 403 });
  }

  const msg = await WarRoomMessage.create({
    war_room_id: room._id,
    user_id:     user._id,
    body:        parsed.data.question,
    msg_type:    'poll',
    attachments: [],
    poll: {
      question: parsed.data.question,
      votes:    [],
    },
  });

  return NextResponse.json(apiResponse({
    id:          String(msg._id),
    war_room_id: String(msg.war_room_id),
    msg_type:    msg.msg_type,
    body:        msg.body,
    poll:        msg.poll,
    created_at:  msg.created_at,
  }), { status: 201 });
}

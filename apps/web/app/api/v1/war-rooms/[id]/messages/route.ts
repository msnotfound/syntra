import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { WarRoom, WarRoomMessage, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { z } from 'zod';

const PostSchema = z.object({
  body:        z.string().min(1).max(10000),
  attachments: z.array(z.string().url()).max(10).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const room = await WarRoom.findOne({ _id: params.id, org_id: user.org_id }).lean();
  if (!room) return NextResponse.json(apiError('NOT_FOUND', 'War room not found'), { status: 404 });

  const messages = await WarRoomMessage.find({ war_room_id: params.id })
    .sort({ created_at: 1 })
    .limit(100)
    .lean();

  return NextResponse.json(apiResponse(messages.map(m => ({
    id:          String(m._id),
    war_room_id: String(m.war_room_id),
    user_id:     String(m.user_id),
    body:        m.body,
    attachments: m.attachments,
    created_at:  m.created_at,
  }))));
}

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
    body:        parsed.data.body,
    attachments: parsed.data.attachments ?? [],
  });

  // Add user to participants if not already there
  await WarRoom.updateOne(
    { _id: params.id, participants: { $ne: user._id } },
    { $addToSet: { participants: user._id } },
  );

  return NextResponse.json(apiResponse({
    id:          String(msg._id),
    war_room_id: String(msg.war_room_id),
    user_id:     String(msg.user_id),
    body:        msg.body,
    attachments: msg.attachments,
    created_at:  msg.created_at,
  }), { status: 201 });
}

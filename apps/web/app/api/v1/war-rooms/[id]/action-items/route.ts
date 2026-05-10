import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { WarRoom, WarRoomActionItem, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { z } from 'zod';

const PostSchema = z.object({
  title:             z.string().min(1).max(500),
  assignee_user_id:  z.string().optional(),
  due_at:            z.string().datetime().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const room = await WarRoom.findOne({ _id: params.id, org_id: user.org_id }).lean();
  if (!room) return NextResponse.json(apiError('NOT_FOUND', 'War room not found'), { status: 404 });

  const items = await WarRoomActionItem.find({ war_room_id: params.id }).sort({ created_at: 1 }).lean();

  return NextResponse.json(apiResponse(items.map(i => ({
    id:               String(i._id),
    war_room_id:      String(i.war_room_id),
    title:            i.title,
    assignee_user_id: i.assignee_user_id ? String(i.assignee_user_id) : null,
    due_at:           i.due_at,
    status:           i.status,
    created_by:       String(i.created_by),
    created_at:       i.created_at,
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

  const item = await WarRoomActionItem.create({
    war_room_id:      room._id,
    org_id:           user.org_id,
    title:            parsed.data.title,
    assignee_user_id: parsed.data.assignee_user_id ?? null,
    due_at:           parsed.data.due_at ? new Date(parsed.data.due_at) : null,
    created_by:       user._id,
  });

  return NextResponse.json(apiResponse({
    id:               String(item._id),
    war_room_id:      String(item.war_room_id),
    title:            item.title,
    assignee_user_id: item.assignee_user_id ? String(item.assignee_user_id) : null,
    due_at:           item.due_at,
    status:           item.status,
    created_by:       String(item.created_by),
    created_at:       item.created_at,
  }), { status: 201 });
}

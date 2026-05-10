import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { WarRoomActionItem, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { z } from 'zod';

const PatchSchema = z.object({
  title:             z.string().min(1).max(500).optional(),
  assignee_user_id:  z.string().nullable().optional(),
  due_at:            z.string().datetime().nullable().optional(),
  status:            z.enum(['open', 'in_progress', 'done']).optional(),
});

interface RouteContext { params: { id: string; item_id: string } }

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'), { status: 400 });
  }

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const update: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.assignee_user_id !== undefined) update.assignee_user_id = parsed.data.assignee_user_id;
  if (parsed.data.due_at !== undefined) update.due_at = parsed.data.due_at ? new Date(parsed.data.due_at) : null;

  const item = await WarRoomActionItem.findOneAndUpdate(
    { _id: params.item_id, war_room_id: params.id, org_id: user.org_id },
    { $set: update },
    { new: true },
  ).lean();

  if (!item) return NextResponse.json(apiError('NOT_FOUND', 'Action item not found'), { status: 404 });

  return NextResponse.json(apiResponse({
    id:               String(item._id),
    war_room_id:      String(item.war_room_id),
    title:            item.title,
    assignee_user_id: item.assignee_user_id ? String(item.assignee_user_id) : null,
    due_at:           item.due_at,
    status:           item.status,
    created_by:       String(item.created_by),
    created_at:       item.created_at,
  }));
}

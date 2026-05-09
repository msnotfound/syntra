import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { WarRoom, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { z } from 'zod';

const CreateSchema = z.object({
  name:      z.string().min(1).max(200),
  alert_id:  z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');

  const query: Record<string, unknown> = { org_id: user.org_id };
  if (status === 'open' || status === 'closed') query.status = status;

  const rooms = await WarRoom.find(query).sort({ created_at: -1 }).limit(50).lean();

  return NextResponse.json(apiResponse(rooms.map(r => ({
    id:           String(r._id),
    name:         r.name,
    status:       r.status,
    alert_id:     r.alert_id ? String(r.alert_id) : null,
    created_by:   String(r.created_by),
    participant_count: r.participants.length,
    created_at:   r.created_at,
  }))));
}

export async function POST(req: NextRequest) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'), { status: 400 });
  }

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const room = await WarRoom.create({
    org_id:       user.org_id,
    alert_id:     parsed.data.alert_id ?? null,
    name:         parsed.data.name,
    status:       'open',
    created_by:   user._id,
    participants: [user._id],
  });

  return NextResponse.json(apiResponse({
    id:         String(room._id),
    name:       room.name,
    status:     room.status,
    alert_id:   room.alert_id ? String(room.alert_id) : null,
    created_by: String(room.created_by),
    created_at: room.created_at,
  }), { status: 201 });
}

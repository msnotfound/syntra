import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { WarRoom, WarRoomMessage, Decision, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { z } from 'zod';

const PostSchema = z.object({
  message_id:    z.string().optional(),
  decision_type: z.enum(['acknowledged', 'assigned', 'closed', 'escalated', 'mitigation_chosen']).optional(),
  decision_text: z.string().min(1).max(2000),
  justification: z.string().max(2000).optional(),
  claim_ids:     z.array(z.string()).max(20).optional(),
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
  if (!room.alert_id) {
    return NextResponse.json(apiError('BAD_REQUEST', 'War room has no linked alert — cannot log decision'), { status: 400 });
  }

  const { decision_text, justification, claim_ids } = parsed.data;

  const justificationStr = JSON.stringify({
    text: justification ?? '',
    claim_chain: claim_ids ?? [],
  });

  const decision = await Decision.create({
    org_id:        user.org_id,
    alert_id:      room.alert_id,
    user_id:       user._id,
    decision_type: parsed.data.decision_type ?? 'mitigation_chosen',
    decision_text,
    justification: justificationStr,
    made_at:       new Date(),
  });

  const sysMsg = await WarRoomMessage.create({
    war_room_id: room._id,
    user_id:     user._id,
    body:        `Decision logged: ${decision_text}`,
    msg_type:    'system',
    attachments: [],
  });

  return NextResponse.json(apiResponse({
    decision_id: String(decision._id),
    message_id:  String(sysMsg._id),
  }), { status: 201 });
}

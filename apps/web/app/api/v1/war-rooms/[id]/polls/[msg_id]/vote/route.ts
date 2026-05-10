import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { WarRoom, WarRoomMessage, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { z } from 'zod';

const PostSchema = z.object({
  vote: z.enum(['yes', 'no', 'abstain']),
});

interface RouteContext { params: { id: string; msg_id: string } }

export async function POST(req: NextRequest, { params }: RouteContext) {
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

  // Remove existing vote by this user, then push the new one
  const msg = await WarRoomMessage.findOneAndUpdate(
    { _id: params.msg_id, war_room_id: params.id, msg_type: 'poll' },
    {
      $pull: { 'poll.votes': { user_id: user._id } },
    },
    { new: true },
  );
  if (!msg) return NextResponse.json(apiError('NOT_FOUND', 'Poll not found'), { status: 404 });

  const updated = await WarRoomMessage.findOneAndUpdate(
    { _id: params.msg_id },
    { $push: { 'poll.votes': { user_id: user._id, vote: parsed.data.vote } } },
    { new: true },
  );

  if (!updated?.poll) return NextResponse.json(apiError('INTERNAL', 'Poll update failed'), { status: 500 });

  const votes = updated.poll.votes;
  const tally = { yes: 0, no: 0, abstain: 0 };
  for (const v of votes) tally[v.vote]++;
  const total = votes.length;

  return NextResponse.json(apiResponse({
    yes:       tally.yes,
    no:        tally.no,
    abstain:   tally.abstain,
    total,
    user_vote: parsed.data.vote,
  }));
}

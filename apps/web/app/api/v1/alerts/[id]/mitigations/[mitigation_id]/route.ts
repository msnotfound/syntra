import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { MitigationSuggestion, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { z } from 'zod';

const PatchSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
});

interface RouteContext { params: { id: string; mitigation_id: string } }

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

  const suggestion = await MitigationSuggestion.findOneAndUpdate(
    { _id: params.mitigation_id, alert_id: params.id, org_id: user.org_id },
    { $set: { status: parsed.data.status } },
    { new: true },
  ).lean();

  if (!suggestion) return NextResponse.json(apiError('NOT_FOUND', 'Mitigation suggestion not found'), { status: 404 });

  return NextResponse.json(apiResponse({
    id:     String(suggestion._id),
    status: suggestion.status,
  }));
}

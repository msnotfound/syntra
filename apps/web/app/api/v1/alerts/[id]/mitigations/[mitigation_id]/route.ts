import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { acceptMitigationSuggestion } from '@/lib/mitigations/acceptance';
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

  let result;
  try {
    result = await acceptMitigationSuggestion({
      alertId: params.id,
      mitigationId: params.mitigation_id,
      orgId: String(user.org_id),
      userId: String(user._id),
      status: parsed.data.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Mitigation suggestion not found';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json(apiError(status === 404 ? 'NOT_FOUND' : 'SERVER_ERROR', message), { status });
  }

  return NextResponse.json(apiResponse({
    id:       result.id,
    status:   result.status,
    followOn: result.followOn,
  }));
}

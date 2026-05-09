import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { NotificationChannel } from '@syntra/db';
import { ensureDb } from '@/lib/db';
import { getServerAuth } from '@/lib/auth';
import { otpStore } from '../../route.js';

const VerifySchema = z.object({ code: z.string().length(6) });

export async function POST(
  req: NextRequest,
  { params }: { params: { channelId: string } },
) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const stored = otpStore.get(params.channelId);
  if (!stored || Date.now() > stored.expiresAt) {
    return NextResponse.json({ error: 'Code expired or not found' }, { status: 410 });
  }
  if (stored.code !== parsed.data.code) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 422 });
  }

  await ensureDb();
  await NotificationChannel.updateOne({ _id: params.channelId }, { verified: true });
  otpStore.delete(params.channelId);

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { NotificationChannel } from '@syntra/db';
import { ensureDb } from '@/lib/db';
import { getServerAuth } from '@/lib/auth';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { channelId: string } },
) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureDb();
  const result = await NotificationChannel.deleteOne({ _id: params.channelId });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

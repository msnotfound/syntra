import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { Event } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const event = await Event.findById(params.id).lean();
  if (!event) return NextResponse.json(apiError('NOT_FOUND', 'Event not found'), { status: 404 });
  return NextResponse.json(apiResponse({ id: String(event._id), ...event }));
}

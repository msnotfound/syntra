import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DigestPreference, Organization, User } from '@syntra/db';
import { ensureDb } from '@/lib/db';
import { getServerAuth } from '@/lib/auth';

const PatchSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  channels: z.array(z.enum(['email', 'whatsapp', 'webhook'])).optional(),
  sections: z.array(z.enum(['alerts', 'severity_heatmap', 'watchlist_health', 'var_summary'])).optional(),
  enabled: z.boolean().optional(),
});

export async function GET(_req: NextRequest) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureDb();
  const org = await Organization.findOne({ slug: session.orgSlug }).lean();
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const pref = await DigestPreference.findOne({ org_id: org._id, user_id: user._id }).lean();
  return NextResponse.json({
    data: pref ?? {
      frequency: 'daily',
      channels: ['email'],
      sections: ['alerts', 'severity_heatmap', 'watchlist_health'],
      enabled: false,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  await ensureDb();
  const org = await Organization.findOne({ slug: session.orgSlug }).lean();
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const pref = await DigestPreference.findOneAndUpdate(
    { org_id: org._id, user_id: user._id },
    { $set: { ...parsed.data, org_id: org._id, user_id: user._id } },
    { new: true, upsert: true, lean: true, setDefaultsOnInsert: true },
  );

  return NextResponse.json({ data: pref });
}

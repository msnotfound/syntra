import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Organization } from '@syntra/db';
import { ensureDb } from '@/lib/db';

const PatchSchema = z.object({
  severity_threshold: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  alert_channels: z.array(z.enum(['email', 'whatsapp', 'webhook'])).optional(),
  quiet_hours_start: z.string().nullable().optional(),
  quiet_hours_end: z.string().nullable().optional(),
  timezone: z.string().optional(),
  webhook_url: z.string().url().nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await ensureDb();
  const org = await Organization.findOne({ slug }).lean();
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data: org.settings });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  await ensureDb();
  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) update[`settings.${k}`] = v;
  }

  const org = await Organization.findOneAndUpdate(
    { slug },
    { $set: update },
    { new: true, lean: true }
  );
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data: org.settings });
}

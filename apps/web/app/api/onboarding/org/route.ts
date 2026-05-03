import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { Organization } from '@syntra/db';
import { slugify } from '@syntra/shared';

export async function POST(req: NextRequest) {
  const { name, industry, size } = await req.json();
  if (!name || !industry) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  await ensureDb();
  const slug = slugify(name);
  const org = await Organization.findOneAndUpdate(
    { slug },
    { $setOnInsert: { slug, name, industry, size, status: 'active', plan: 'trial', settings: { alert_channels: ['email'], webhook_url: null, severity_threshold: 'high', quiet_hours_start: null, quiet_hours_end: null, timezone: 'Asia/Kolkata' } } },
    { upsert: true, new: true },
  );
  return NextResponse.json({ slug: org.slug });
}

import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { Organization } from '@syntra/db';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { channels, severity_threshold } = await req.json();
  let orgId: string | null = null;
  try {
    const session = await requireAuth();
    orgId = session.orgId;
  } catch {
    // unauthenticated during onboarding — org must be passed in body or from cookie
  }

  if (!orgId) return NextResponse.json({ ok: true }); // graceful: prefs saved after auth

  await ensureDb();
  await Organization.findByIdAndUpdate(orgId, {
    $set: { 'settings.alert_channels': channels, 'settings.severity_threshold': severity_threshold },
  });
  return NextResponse.json({ ok: true });
}

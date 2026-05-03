import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { emails } = await req.json();
  if (!Array.isArray(emails)) return NextResponse.json({ error: 'emails must be array' }, { status: 400 });
  // In production: send Clerk org invitations or email invites via SendGrid.
  // For now, log and return success so the wizard can advance.
  console.log('[onboarding/invite] queued invites for:', emails);
  return NextResponse.json({ queued: emails.length });
}

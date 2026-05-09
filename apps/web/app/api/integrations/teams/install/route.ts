import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const orgSlug = req.nextUrl.searchParams.get('org');
  if (!orgSlug) return NextResponse.json({ error: 'Missing org parameter' }, { status: 400 });

  if (!process.env.TEAMS_APP_ID) {
    const callbackUrl = new URL('/api/integrations/teams/oauth/callback', req.nextUrl.origin);
    callbackUrl.searchParams.set('code', 'mock-code');
    callbackUrl.searchParams.set('state', orgSlug);
    return NextResponse.redirect(callbackUrl);
  }

  const tenantId = process.env.TEAMS_TENANT_ID ?? 'common';
  const params = new URLSearchParams({
    client_id: process.env.TEAMS_APP_ID,
    response_type: 'code',
    scope: 'https://graph.microsoft.com/.default',
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/teams/oauth/callback`,
    state: orgSlug,
  });

  return NextResponse.redirect(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`);
}

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const orgSlug = req.nextUrl.searchParams.get('org');
  if (!orgSlug) return NextResponse.json({ error: 'Missing org parameter' }, { status: 400 });

  if (!process.env.SLACK_CLIENT_ID) {
    const callbackUrl = new URL('/api/integrations/slack/oauth/callback', req.nextUrl.origin);
    callbackUrl.searchParams.set('code', 'mock-code');
    callbackUrl.searchParams.set('state', orgSlug);
    return NextResponse.redirect(callbackUrl);
  }

  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID,
    scope: 'chat:write,commands',
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/slack/oauth/callback`,
    state: orgSlug,
  });

  return NextResponse.redirect(`https://slack.com/oauth/v2/authorize?${params}`);
}

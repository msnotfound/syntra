import { NextRequest, NextResponse } from 'next/server';
import { connectDb, Organization, SlackInstall } from '@syntra/db';
import { encryptToken } from '@syntra/shared/token-encrypt';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state'); // orgSlug
  if (!code || !state) return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });

  await connectDb();
  const org = await Organization.findOne({ slug: state }).lean();
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

  let access_token: string;
  let team_id: string;
  let team_name: string;
  let scope: string;

  if (!process.env.SLACK_CLIENT_ID) {
    const mock = await import('@syntra/shared/mocks/slack.js');
    ({ access_token, team_id, team_name, scope } = await mock.oauthAccess(code));
  } else {
    const res = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/slack/oauth/callback`,
      }),
    });
    const data = await res.json() as {
      ok: boolean;
      access_token: string;
      team: { id: string; name: string };
      scope: string;
      error?: string;
    };
    if (!data.ok) return NextResponse.json({ error: data.error ?? 'Slack OAuth failed' }, { status: 400 });
    access_token = data.access_token;
    team_id = data.team.id;
    team_name = data.team.name;
    scope = data.scope;
  }

  await SlackInstall.findOneAndUpdate(
    { org_id: org._id },
    {
      workspace_id: team_id!,
      team_name: team_name!,
      bot_token_encrypted: encryptToken(access_token!),
      scope: scope!,
      installed_at: new Date(),
    },
    { upsert: true, new: true },
  );

  const redirect = new URL(`/app/${state}/settings/integrations`, req.nextUrl.origin);
  redirect.searchParams.set('connected', 'slack');
  return NextResponse.redirect(redirect);
}

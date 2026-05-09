import { NextRequest, NextResponse } from 'next/server';
import { connectDb, Organization, TeamsInstall } from '@syntra/db';
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
  let tenant_id: string;

  if (!process.env.TEAMS_APP_ID) {
    const mock = await import('@syntra/shared/mocks/teams');
    ({ access_token } = await mock.oauthToken('mock-tenant', code));
    team_id = 'T_MOCK_TEAMS';
    tenant_id = 'mock-tenant';
  } else {
    const tenantId = process.env.TEAMS_TENANT_ID ?? 'common';
    const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.TEAMS_APP_ID!,
        client_secret: process.env.TEAMS_APP_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/teams/oauth/callback`,
        scope: 'https://graph.microsoft.com/.default',
      }),
    });
    const data = await res.json() as { access_token?: string; error?: string; tenant_id?: string };
    if (!data.access_token) return NextResponse.json({ error: data.error ?? 'Teams OAuth failed' }, { status: 400 });
    access_token = data.access_token;
    tenant_id = data.tenant_id ?? tenantId;
    team_id = `${String(org._id)}-teams`;
  }

  await TeamsInstall.findOneAndUpdate(
    { org_id: org._id },
    {
      team_id: team_id!,
      tenant_id: tenant_id!,
      bot_token_encrypted: encryptToken(access_token!),
      installed_at: new Date(),
    },
    { upsert: true, new: true },
  );

  const redirect = new URL(`/app/${state}/settings/integrations`, req.nextUrl.origin);
  redirect.searchParams.set('connected', 'teams');
  return NextResponse.redirect(redirect);
}

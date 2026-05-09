import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { connectDb, Alert } from '@syntra/db';

export function validateSlackSignature(signingSecret: string, timestamp: string, rawBody: string, signature: string): boolean {
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) return false; // replay protection: 5 min window

  const baseStr = `v0:${timestamp}:${rawBody}`;
  const computed = `v0=${createHmac('sha256', signingSecret).update(baseStr).digest('hex')}`;
  try {
    return timingSafeEqual(Buffer.from(computed, 'utf8'), Buffer.from(signature, 'utf8'));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  const rawBody = await req.text();
  const timestamp = req.headers.get('x-slack-request-timestamp') ?? '';
  const signature = req.headers.get('x-slack-signature') ?? '';

  if (signingSecret && !validateSlackSignature(signingSecret, timestamp, rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: {
    type: string;
    actions?: Array<{ action_id: string; value: string }>;
    user?: { id: string };
    response_url?: string;
  };

  try {
    const params = new URLSearchParams(rawBody);
    payload = JSON.parse(params.get('payload') ?? '{}');
  } catch {
    return NextResponse.json({ error: 'Bad payload' }, { status: 400 });
  }

  if (payload.type !== 'block_actions') return new NextResponse(null, { status: 200 });

  const action = payload.actions?.[0];
  if (!action) return new NextResponse(null, { status: 200 });

  const alertId = action.value;
  await connectDb();

  if (action.action_id === 'acknowledge') {
    await Alert.updateOne(
      { _id: alertId, acknowledged_at: null },
      { acknowledged_at: new Date(), status: 'triaged' },
    );
    return NextResponse.json({ text: 'Alert acknowledged.' });
  }

  if (action.action_id === 'assign_to_me') {
    await Alert.updateOne(
      { _id: alertId },
      {
        $push: { comments: { user_id: new (await import('mongoose')).default.Types.ObjectId(), body: `Assigned via Slack by ${payload.user?.id ?? 'unknown'}`, created_at: new Date() } },
        status: 'triaged',
      },
    );
    return NextResponse.json({ text: 'Assigned to you in Syntra.' });
  }

  // open_in_app and any other actions — just acknowledge
  return new NextResponse(null, { status: 200 });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';

const BodySchema = z.object({ url: z.string().url() });

const SAMPLE_PAYLOAD = {
  event: 'alert.triggered',
  alert_id: 'test_alert_000',
  org_slug: 'test-org',
  severity: 'high',
  title: 'Syntra webhook test',
  message: 'This is a test payload from Syntra. Your webhook is configured correctly.',
  entity: { type: 'company', name: 'Test Entity Ltd', cin: 'U12345MH2020PLC000001' },
  triggered_at: new Date().toISOString(),
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'url is required and must be a valid URL' }, { status: 400 });
  }

  const { url } = parsed.data;
  const payload = JSON.stringify(SAMPLE_PAYLOAD);
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? 'syntra-test-secret';
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-syntra-signature': signature,
        'x-syntra-event': 'alert.triggered',
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
    });

    const latency_ms = Date.now() - start;
    const response_body = await res.text().catch(() => '');
    return NextResponse.json({
      status: 'ok',
      response_code: res.status,
      response_body: response_body.slice(0, 500),
      latency_ms,
    });
  } catch (err) {
    const latency_ms = Date.now() - start;
    return NextResponse.json({
      status: 'error',
      response_code: 0,
      response_body: err instanceof Error ? err.message : 'Unknown error',
      latency_ms,
    }, { status: 502 });
  }
}

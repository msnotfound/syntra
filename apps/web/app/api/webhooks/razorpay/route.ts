import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ensureDb } from '@/lib/db';
import { Subscription, Organization } from '@syntra/db';

const PLAN_FROM_AMOUNT: Record<number, 'starter' | 'growth' | 'enterprise'> = {
  199900:  'starter',   // ₹1999/mo
  499900:  'growth',    // ₹4999/mo
  999900:  'enterprise', // ₹9999/mo
};

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const digest = hmac.digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

function planFromAmount(amountPaise: number): 'starter' | 'growth' | 'enterprise' {
  return PLAN_FROM_AMOUNT[amountPaise] ?? 'starter';
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (webhookSecret) {
    if (!signature || !verifySignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  } else {
    const { verifyWebhookSignature } = await import('@syntra/shared/mocks/razorpay');
    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  }

  let event: { event: string; payload: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventId: string = (event.payload as { id?: string }).id ?? `${event.event}_${Date.now()}`;

  await ensureDb();

  // Idempotency: skip if this event was already processed
  const alreadyProcessed = await Subscription.exists({ 'metadata.processed_event_ids': eventId });
  if (alreadyProcessed) return NextResponse.json({ ok: true, skipped: true });

  const eventType = event.event;

  if (eventType === 'order.paid') {
    const payment = (event.payload as { payment?: { entity?: Record<string, unknown> } }).payment?.entity;
    if (!payment) return NextResponse.json({ ok: true });

    const subscriptionId = payment.subscription_id as string | undefined;
    const amountPaise = (payment.amount as number) ?? 0;
    const plan = planFromAmount(amountPaise);

    if (subscriptionId) {
      await Subscription.findOneAndUpdate(
        { razorpay_subscription_id: subscriptionId },
        {
          $set: { status: 'active', plan, amount_paise: amountPaise },
          $addToSet: { 'metadata.processed_event_ids': eventId },
        },
      );
    }
  } else if (eventType === 'payment.failed') {
    const payment = (event.payload as { payment?: { entity?: Record<string, unknown> } }).payment?.entity;
    const subscriptionId = payment?.subscription_id as string | undefined;
    if (subscriptionId) {
      await Subscription.findOneAndUpdate(
        { razorpay_subscription_id: subscriptionId },
        {
          $set: { status: 'halted' },
          $addToSet: { 'metadata.processed_event_ids': eventId },
        },
      );
    }
  } else if (eventType === 'subscription.activated') {
    const sub = (event.payload as { subscription?: { entity?: Record<string, unknown> } }).subscription?.entity;
    if (!sub) return NextResponse.json({ ok: true });

    const subscriptionId = sub.id as string;
    const amountPaise = (sub.plan_id_amount as number) ?? 0;
    const plan = planFromAmount(amountPaise);
    const periodEnd = new Date(((sub.current_end as number) ?? 0) * 1000);
    const periodStart = new Date(((sub.current_start as number) ?? 0) * 1000);

    const updated = await Subscription.findOneAndUpdate(
      { razorpay_subscription_id: subscriptionId },
      {
        $set: { status: 'active', plan, current_period_start: periodStart, current_period_end: periodEnd },
        $addToSet: { 'metadata.processed_event_ids': eventId },
      },
      { new: true },
    );

    if (updated) {
      await Organization.findByIdAndUpdate(updated.org_id, { $set: { plan } });
    }
  }

  return NextResponse.json({ ok: true });
}

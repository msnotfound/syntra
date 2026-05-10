import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { NotificationChannel, Organization, User } from '@syntra/db';
import { ensureDb } from '@/lib/db';
import { getServerAuth } from '@/lib/auth';

const PostSchema = z.object({
  channel_type: z.enum(['email', 'slack', 'teams', 'webhook', 'sms']),
  destination:  z.string().min(1).max(500),
});

export async function GET(_req: NextRequest) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureDb();
  const [org, user] = await Promise.all([
    Organization.findOne({ slug: session.orgSlug }).lean(),
    User.findOne({ clerk_user_id: session.userId }).lean(),
  ]);
  if (!org || !user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const channels = await NotificationChannel.find({ org_id: org._id, user_id: user._id })
    .sort({ created_at: -1 })
    .lean();

  return NextResponse.json({ data: channels });
}

export async function POST(req: NextRequest) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  await ensureDb();
  const [org, user] = await Promise.all([
    Organization.findOne({ slug: session.orgSlug }).lean(),
    User.findOne({ clerk_user_id: session.userId }).lean(),
  ]);
  if (!org || !user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const channel = await NotificationChannel.create({
    org_id:       org._id,
    user_id:      user._id,
    channel_type: parsed.data.channel_type,
    destination:  parsed.data.destination,
    verified:     false,
  });

  // For email/SMS: fire OTP (side-effect only, non-blocking)
  if (parsed.data.channel_type === 'email' || parsed.data.channel_type === 'sms') {
    sendVerificationCode(String(channel._id), parsed.data.channel_type, parsed.data.destination).catch(
      err => console.error('[notifications/channels] OTP send failed', err),
    );
  } else {
    // Slack/Teams/Webhook — auto-verified (ownership implied by access)
    await NotificationChannel.updateOne({ _id: channel._id }, { verified: true });
    channel.verified = true;
  }

  return NextResponse.json({ data: channel }, { status: 201 });
}

async function sendVerificationCode(channelId: string, type: 'email' | 'sms', destination: string) {
  const { randomInt } = await import('crypto');
  const code = String(randomInt(100000, 999999));

  // Store code in a transient cache (production: Redis; dev: in-memory map)
  otpStore.set(channelId, { code, expiresAt: Date.now() + 10 * 60 * 1000 });

  if (type === 'email') {
    const sendEmail = process.env.SENDGRID_API_KEY
      ? (await import('@sendgrid/mail')).default.send.bind((await import('@sendgrid/mail')).default)
      : (await import('@syntra/shared/mocks/sendgrid.js')).sendEmail;
    await (sendEmail as Function)({
      to: destination,
      from: process.env.SENDGRID_FROM_EMAIL ?? 'alerts@syntra.app',
      subject: `Your Syntra verification code: ${code}`,
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your Syntra verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
    });
  } else {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const twilio = (await import('twilio')).default;
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        to: destination,
        from: process.env.TWILIO_FROM_NUMBER ?? 'sandbox',
        body: `Your Syntra code: ${code}`,
      });
    } else {
      const { sendWhatsApp } = await import('@syntra/shared/mocks/twilio.js');
      await sendWhatsApp({ to: destination, from: 'sandbox', body: `Your Syntra code: ${code}` });
    }
  }
}

// In-process OTP store (acceptable for dev; swap for Redis in production)
export const otpStore = new Map<string, { code: string; expiresAt: number }>();

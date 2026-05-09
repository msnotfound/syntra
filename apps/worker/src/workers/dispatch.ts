import { Queue, Worker } from 'bullmq';
import { connectDb, Alert, WatchlistEntity, Organization, SlackInstall, TeamsInstall } from '@syntra/db';
import type { IAlert, IOrganization, IWatchlistEntity } from '@syntra/db';
import { generateAlertContext } from '@syntra/llm';
import { getSlackDispatchQueue } from './slack-dispatch.js';
import { getTeamsDispatchQueue } from './teams-dispatch.js';

const REDIS_URL = process.env.UPSTASH_REDIS_URL;
const connection = REDIS_URL
  ? { url: REDIS_URL }
  : { host: 'localhost', port: 6379 };

let queue: Queue | null = null;

export function getDispatchQueue(): Queue {
  if (!queue) queue = new Queue('alert-dispatch', { connection });
  return queue;
}

export function startDispatchWorker() {
  const worker = new Worker('alert-dispatch', async (job) => {
    const { alertId } = job.data as { alertId: string };
    await connectDb();

    const alert = await Alert.findById(alertId).lean() as IAlert | null;
    if (!alert || alert.dispatched_at) return;

    const org = await Organization.findById(alert.org_id).lean() as IOrganization | null;
    if (!org || org.status !== 'active') return;

    const entities = await WatchlistEntity.find({ _id: { $in: alert.watchlist_entity_ids } }).lean() as unknown as IWatchlistEntity[];
    const entityNames = entities.map(e => e.name);

    // Generate LLM context
    const cacheKey = `${String(alert.event_id)}:${String(alert.org_id)}`;
    const llmCtx = await generateAlertContext(
      alert.event_snapshot.title,
      alert.event_snapshot.description,
      entityNames,
      org.industry ?? 'export/trade',
      cacheKey,
    );

    await Alert.updateOne({ _id: alertId }, {
      'llm_context.why_matters': llmCtx.whyMatters,
      'llm_context.recommended_actions': llmCtx.recommendedActions,
    });

    const channelsSent: string[] = [];
    const channels = org.settings.alert_channels;

    if (channels.includes('email')) {
      await dispatchEmail(alert, org, entities, llmCtx);
      channelsSent.push('email');
    }
    if (channels.includes('whatsapp') && org.contact_phone) {
      await dispatchWhatsApp(alert, org, llmCtx);
      channelsSent.push('whatsapp');
    }
    if (channels.includes('webhook') && org.settings.webhook_url) {
      await dispatchWebhook(alert, org);
      channelsSent.push('webhook');
    }

    await Alert.updateOne({ _id: alertId }, { dispatched_at: new Date(), channels_sent: channelsSent });

    // M23: enqueue to Slack / Teams if installed for this org
    const orgIdStr = String(org._id);
    const [slackInstall, teamsInstall] = await Promise.all([
      SlackInstall.findOne({ org_id: org._id }).lean(),
      TeamsInstall.findOne({ org_id: org._id }).lean(),
    ]);
    if (slackInstall) await getSlackDispatchQueue().add('slack-alert', { alertId, orgId: orgIdStr });
    if (teamsInstall) await getTeamsDispatchQueue().add('teams-alert', { alertId, orgId: orgIdStr });
  }, { connection });

  worker.on('failed', (job, err) => console.error('[dispatch] Job failed', job?.id, err.message));
  return worker;
}

async function dispatchEmail(alert: IAlert, org: IOrganization, entities: IWatchlistEntity[], llmCtx: { whyMatters: string; recommendedActions: string[] }) {
  const sendEmail = process.env.SENDGRID_API_KEY
    ? (await import('@sendgrid/mail')).default.send.bind((await import('@sendgrid/mail')).default)
    : (await import('@syntra/shared/mocks/sendgrid')).sendEmail;

  const severityEmoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' }[alert.severity] ?? '⚪';
  const subject = `[${alert.severity.toUpperCase()}] ${alert.event_snapshot.title}`;
  const affectedList = entities.map(e => `• ${e.name} (${e.type})`).join('\n');

  const html = `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#151921;color:#FAFAFA;padding:24px;border-radius:6px;">
  <div style="font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;color:#94A3B8;margin-bottom:8px;">${severityEmoji} ${alert.severity.toUpperCase()} ALERT</div>
  <h1 style="font-size:20px;font-weight:600;margin:0 0 8px;">${alert.event_snapshot.title}</h1>
  <p style="color:#94A3B8;margin:0 0 16px;">${alert.event_snapshot.country} · ${new Date(alert.event_snapshot.occurred_at).toUTCString()}</p>
  <p style="margin:0 0 16px;">${alert.event_snapshot.description}</p>
  <div style="border-top:1px solid #262C36;padding-top:16px;margin-bottom:16px;">
    <div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;color:#94A3B8;margin-bottom:8px;">Why this matters to you</div>
    <p>${llmCtx.whyMatters}</p>
    <p style="margin:8px 0 0;"><strong>Affected entities:</strong></p>
    <p style="white-space:pre-line;color:#94A3B8;">${affectedList}</p>
  </div>
  <div style="border-top:1px solid #262C36;padding-top:16px;margin-bottom:16px;">
    <div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;color:#94A3B8;margin-bottom:8px;">Recommended Actions (AI-generated)</div>
    <ul>${llmCtx.recommendedActions.map(a => `<li>${a}</li>`).join('')}</ul>
  </div>
  <div style="border-top:1px solid #262C36;padding-top:16px;color:#64748B;font-size:12px;">
    Syntra · alerts@syntra.app · <a href="${process.env.NEXT_PUBLIC_APP_URL}/app/${org.slug}/alerts" style="color:#3B82F6;">View in dashboard</a>
  </div>
</div>`;

  await (sendEmail as Function)({
    to: org.contact_email,
    from: process.env.SENDGRID_FROM_EMAIL ?? 'alerts@syntra.app',
    subject,
    html,
    text: `${subject}\n\n${alert.event_snapshot.description}\n\nAffected:\n${affectedList}\n\nRecommended:\n${llmCtx.recommendedActions.join('\n')}`,
    messageId: String(alert._id),
  });
}

async function dispatchWhatsApp(alert: IAlert, org: IOrganization, llmCtx: { whyMatters: string; recommendedActions: string[] }) {
  const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' }[alert.severity] ?? '⚪';
  const payload = {
    to: `whatsapp:${org.contact_phone}`,
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM ?? 'sandbox'}`,
    body: `${emoji} *${alert.severity.toUpperCase()}* — ${alert.event_snapshot.title}\n📍 ${alert.event_snapshot.country}\n\n${llmCtx.whyMatters}\n\nView: ${process.env.NEXT_PUBLIC_APP_URL}/app/${org.slug}/alerts/${String(alert._id)}`,
  };

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = (await import('twilio')).default;
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({ to: payload.to, from: payload.from, body: payload.body });
  } else {
    const { sendWhatsApp } = await import('@syntra/shared/mocks/twilio');
    await sendWhatsApp(payload);
  }
}

async function dispatchWebhook(alert: IAlert, org: IOrganization) {
  if (!org.settings.webhook_url) return;
  const payload = {
    event: 'alert.created',
    alert_id: String(alert._id),
    severity: alert.severity,
    title: alert.event_snapshot.title,
    occurred_at: alert.event_snapshot.occurred_at,
  };
  const body = JSON.stringify(payload);
  const { createHmac } = await import('crypto');
  const secret = process.env.WEBHOOK_SECRET ?? 'dev-secret';
  const sig = createHmac('sha256', secret).update(body).digest('hex');

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(org.settings.webhook_url!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Syntra-Signature': sig },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return;
    } catch {
      if (attempt === 2) console.error('[dispatch] Webhook failed after 3 attempts');
      await new Promise(r => setTimeout(r, 2 ** attempt * 1000));
    }
  }
}

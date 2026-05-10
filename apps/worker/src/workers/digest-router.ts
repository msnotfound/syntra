/**
 * M37 digest-router: picks the correct channel(s) per user pref, formats per
 * the format flag, and dispatches via the correct provider.
 *
 * Designed as an additive code path — callers wrap their existing dispatch
 * logic, so the existing email/whatsapp/webhook path is never replaced.
 */

import { connectDb, Alert, DigestPreference } from '@syntra/db';
import type { IAlert, IChannelConfig, IDeliveryWindow, NotificationFormat, Severity } from '@syntra/db';
import { getSlackDispatchQueue } from './slack-dispatch.js';
import { getTeamsDispatchQueue } from './teams-dispatch.js';

// ---------------------------------------------------------------------------
// Severity ordering — lower index = more severe
// ---------------------------------------------------------------------------

const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export function severityMeetsThreshold(alertSev: Severity, threshold: Severity): boolean {
  return SEV_ORDER.indexOf(alertSev) <= SEV_ORDER.indexOf(threshold);
}

// ---------------------------------------------------------------------------
// Quiet-hours check using delivery_window
// ---------------------------------------------------------------------------

export function isInDeliveryWindow(window: IDeliveryWindow, nowUtcMs?: number): boolean {
  const now = new Date(nowUtcMs ?? Date.now());
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: window.timezone,
    hour: 'numeric',
    hour12: false,
  });
  const localHour = parseInt(formatter.format(now), 10);

  const { start_hour, end_hour } = window;
  // Window may wrap midnight (e.g. 22-06 means 22,23,0,1,2,3,4,5)
  if (start_hour <= end_hour) {
    return localHour >= start_hour && localHour < end_hour;
  }
  // Wraps midnight
  return localHour >= start_hour || localHour < end_hour;
}

// ---------------------------------------------------------------------------
// Format helpers — builds the message body for each format tier
// ---------------------------------------------------------------------------

export interface FormattedAlert {
  subject: string;
  oneliner: string;
  summary: string;
  full: string;
}

const SEV_EMOJI: Record<string, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵', info: '⚪' };

export function formatAlert(alert: IAlert, format: NotificationFormat): string {
  const emoji = SEV_EMOJI[alert.severity] ?? '⚪';
  const title = alert.event_snapshot.title;
  const country = alert.event_snapshot.country;

  if (format === 'oneliner') {
    return `${emoji} [${alert.severity.toUpperCase()}] ${title} — ${country}`;
  }

  if (format === 'summary') {
    const why = alert.llm_context.why_matters ?? '';
    return [
      `${emoji} ${alert.severity.toUpperCase()}: ${title}`,
      `📍 ${country}`,
      why ? `\n${why}` : '',
    ].filter(Boolean).join('\n');
  }

  // full — mirrors the existing email body (plain-text variant)
  const actions = (alert.llm_context.recommended_actions ?? []).map(a => `• ${a}`).join('\n');
  return [
    `${emoji} ${alert.severity.toUpperCase()}: ${title}`,
    `📍 ${country}  ·  ${new Date(alert.event_snapshot.occurred_at).toUTCString()}`,
    '',
    alert.event_snapshot.description,
    alert.llm_context.why_matters ? `\nWhy this matters:\n${alert.llm_context.why_matters}` : '',
    actions ? `\nRecommended actions:\n${actions}` : '',
  ].filter(s => s !== undefined).join('\n');
}

// ---------------------------------------------------------------------------
// Per-channel dispatch
// ---------------------------------------------------------------------------

async function routeToChannel(
  alert: IAlert,
  config: IChannelConfig,
  orgId: string,
): Promise<void> {
  const body = formatAlert(alert, config.format);
  const alertId = String(alert._id);

  switch (config.channel_id) {
    case 'slack': {
      // Use destination_id as the channel override; the worker fetches the token itself
      await getSlackDispatchQueue().add('slack-alert-m37', {
        alertId,
        orgId,
        channelOverride: config.destination_id,
        format: config.format,
      });
      break;
    }

    case 'teams': {
      await getTeamsDispatchQueue().add('teams-alert-m37', {
        alertId,
        orgId,
        conversationOverride: config.destination_id,
        format: config.format,
      });
      break;
    }

    case 'email': {
      const subject = `[${alert.severity.toUpperCase()}] ${alert.event_snapshot.title}`;
      const sendEmail = process.env.SENDGRID_API_KEY
        ? (await import('@sendgrid/mail')).default.send.bind((await import('@sendgrid/mail')).default)
        : (await import('@syntra/shared/mocks/sendgrid.js')).sendEmail;
      await (sendEmail as Function)({
        to: config.destination_id,
        from: process.env.SENDGRID_FROM_EMAIL ?? 'alerts@syntra.app',
        subject,
        text: body,
        html: `<pre style="font-family:system-ui;white-space:pre-wrap">${body}</pre>`,
        messageId: alertId,
      });
      break;
    }

    case 'webhook': {
      const payload = JSON.stringify({
        event: 'alert.created',
        alert_id: alertId,
        severity: alert.severity,
        title: alert.event_snapshot.title,
        occurred_at: alert.event_snapshot.occurred_at,
        body,
      });
      const { createHmac } = await import('crypto');
      const secret = process.env.WEBHOOK_SECRET ?? 'dev-secret';
      const sig = createHmac('sha256', secret).update(payload).digest('hex');
      try {
        await fetch(config.destination_id, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Syntra-Signature': sig },
          body: payload,
          signal: AbortSignal.timeout(10_000),
        });
      } catch (err) {
        console.error('[digest-router] webhook dispatch failed', config.destination_id, err);
      }
      break;
    }

    case 'sms': {
      const smsBody = formatAlert(alert, 'oneliner'); // SMS always oneliner
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        const twilio = (await import('twilio')).default;
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
          to: config.destination_id,
          from: process.env.TWILIO_FROM_NUMBER ?? process.env.TWILIO_WHATSAPP_FROM ?? 'sandbox',
          body: smsBody,
        });
      } else {
        const { sendWhatsApp } = await import('@syntra/shared/mocks/twilio.js');
        await sendWhatsApp({ to: config.destination_id, from: 'sandbox', body: smsBody });
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API — call from dispatch worker after existing channels
// ---------------------------------------------------------------------------

export interface RouteAlertOptions {
  alertId: string;
  orgId: string;
  nowUtcMs?: number;
}

export interface RouteAlertResult {
  routed: number;
  skipped_quiet_hours: number;
  skipped_threshold: number;
}

export async function routeAlertToUserChannels(opts: RouteAlertOptions): Promise<RouteAlertResult> {
  await connectDb();

  const alert = await Alert.findById(opts.alertId).lean() as IAlert | null;
  if (!alert) return { routed: 0, skipped_quiet_hours: 0, skipped_threshold: 0 };

  const prefs = await DigestPreference.find({
    org_id: opts.orgId,
    enabled: true,
    'channel_configs.0': { $exists: true },
  }).lean();

  let routed = 0;
  let skipped_quiet_hours = 0;
  let skipped_threshold = 0;

  for (const pref of prefs) {
    // Quiet-hours check
    if (!isInDeliveryWindow(pref.delivery_window, opts.nowUtcMs)) {
      skipped_quiet_hours++;
      continue;
    }

    // Priority threshold check
    if (!severityMeetsThreshold(alert.severity as Severity, pref.priority_threshold as Severity)) {
      skipped_threshold++;
      continue;
    }

    // Dispatch to each enabled channel config
    for (const config of pref.channel_configs) {
      if (!config.enabled) continue;
      await routeToChannel(alert, config, opts.orgId);
      routed++;
    }
  }

  return { routed, skipped_quiet_hours, skipped_threshold };
}

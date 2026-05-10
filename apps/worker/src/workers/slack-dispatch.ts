import { Queue, Worker } from 'bullmq';
import { connectDb, Alert, SlackInstall } from '@syntra/db';
import type { IAlert } from '@syntra/db';
import { decryptToken } from '@syntra/shared/token-encrypt';

const REDIS_URL = process.env.UPSTASH_REDIS_URL;
const connection = REDIS_URL ? { url: REDIS_URL } : { host: 'localhost', port: 6379 };

let queue: Queue | null = null;

export function getSlackDispatchQueue(): Queue {
  if (!queue) queue = new Queue('slack-dispatch', { connection });
  return queue;
}

const SEV_EMOJI: Record<string, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' };

export function buildSlackCard(alert: Pick<IAlert, '_id' | 'severity' | 'event_snapshot' | 'llm_context'>, appUrl: string) {
  const emoji = SEV_EMOJI[alert.severity] ?? '⚪';
  const alertId = String(alert._id);
  const openUrl = `${appUrl}/app/alerts/${alertId}`;

  return {
    text: `${emoji} ${alert.severity.toUpperCase()}: ${alert.event_snapshot.title}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${emoji} ${alert.severity.toUpperCase()}: ${alert.event_snapshot.title}`, emoji: true },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: alert.event_snapshot.description },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `📍 ${alert.event_snapshot.country}  ·  📅 ${new Date(alert.event_snapshot.occurred_at).toUTCString()}` },
        ],
      },
      { type: 'divider' },
      ...(alert.llm_context.why_matters ? [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Why this matters to your organization*\n${alert.llm_context.why_matters}` },
        },
      ] : []),
      {
        type: 'actions',
        block_id: 'alert_actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Acknowledge', emoji: false },
            style: 'primary',
            action_id: 'acknowledge',
            value: alertId,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Assign to me', emoji: false },
            action_id: 'assign_to_me',
            value: alertId,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open in app', emoji: false },
            action_id: 'open_in_app',
            url: openUrl,
            value: alertId,
          },
        ],
      },
    ],
  };
}

export function startSlackDispatchWorker() {
  const worker = new Worker('slack-dispatch', async (job) => {
    const { alertId, orgId } = job.data as { alertId: string; orgId: string };
    await connectDb();

    const [alert, install] = await Promise.all([
      Alert.findById(alertId).lean() as Promise<IAlert | null>,
      SlackInstall.findOne({ org_id: orgId }).lean(),
    ]);

    if (!alert || !install) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.syntra.app';
    const card = buildSlackCard(alert, appUrl);

    const botToken = decryptToken(install.bot_token_encrypted);

    if (process.env.SLACK_CLIENT_ID) {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${botToken}` },
        body: JSON.stringify({ channel: install.workspace_id, ...card }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (!data.ok) console.error('[slack-dispatch] postMessage failed:', data.error);
    } else {
      const mock = await import('@syntra/shared/mocks/slack.js');
      await mock.postMessage(botToken, { channel: install.workspace_id, ...card });
    }
  }, { connection });

  worker.on('failed', (job, err) => console.error('[slack-dispatch] Job failed', job?.id, err.message));
  return worker;
}

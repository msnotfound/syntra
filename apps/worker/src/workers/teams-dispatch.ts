import { Queue, Worker } from 'bullmq';
import { connectDb, Alert, TeamsInstall } from '@syntra/db';
import type { IAlert } from '@syntra/db';
import { decryptToken } from '@syntra/shared/token-encrypt';

const REDIS_URL = process.env.UPSTASH_REDIS_URL;
const connection = REDIS_URL ? { url: REDIS_URL } : { host: 'localhost', port: 6379 };

let queue: Queue | null = null;

export function getTeamsDispatchQueue(): Queue {
  if (!queue) queue = new Queue('teams-dispatch', { connection });
  return queue;
}

const SEV_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F97316', medium: '#EAB308', low: '#60A5FA' };

export function buildTeamsCard(alert: Pick<IAlert, '_id' | 'severity' | 'event_snapshot' | 'llm_context'>, appUrl: string, actionsUrl: string) {
  const alertId = String(alert._id);
  const color = SEV_COLOR[alert.severity] ?? '#94A3B8';
  const openUrl = `${appUrl}/app/alerts/${alertId}`;

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      {
        type: 'Container',
        style: 'emphasis',
        bleed: true,
        items: [
          {
            type: 'ColumnSet',
            columns: [
              {
                type: 'Column',
                width: 'auto',
                items: [{ type: 'TextBlock', text: `■`, color: 'attention', size: 'large', weight: 'bolder' }],
              },
              {
                type: 'Column',
                width: 'stretch',
                items: [
                  { type: 'TextBlock', text: `${alert.severity.toUpperCase()}: ${alert.event_snapshot.title}`, weight: 'bolder', size: 'medium', wrap: true },
                ],
              },
            ],
          },
        ],
      },
      { type: 'TextBlock', text: alert.event_snapshot.description, wrap: true, spacing: 'medium' },
      {
        type: 'FactSet',
        spacing: 'small',
        facts: [
          { title: 'Country', value: alert.event_snapshot.country },
          { title: 'Event type', value: alert.event_snapshot.event_type },
          { title: 'Occurred', value: new Date(alert.event_snapshot.occurred_at).toUTCString() },
        ],
      },
      ...(alert.llm_context.why_matters ? [
        { type: 'TextBlock', text: '**Why this matters to your organization**', weight: 'bolder', spacing: 'medium' },
        { type: 'TextBlock', text: alert.llm_context.why_matters, wrap: true },
      ] : []),
    ],
    actions: [
      {
        type: 'Action.Http',
        title: 'Acknowledge',
        method: 'POST',
        url: `${actionsUrl}?action=acknowledge&alertId=${alertId}`,
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        body: JSON.stringify({ action: 'acknowledge', alertId }),
      },
      {
        type: 'Action.Http',
        title: 'Assign to me',
        method: 'POST',
        url: `${actionsUrl}?action=assign_to_me&alertId=${alertId}`,
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        body: JSON.stringify({ action: 'assign_to_me', alertId }),
      },
      {
        type: 'Action.OpenUrl',
        title: 'Open in app',
        url: openUrl,
      },
    ],
    // accent color hint — rendered by Teams connector
    themeColor: color.replace('#', ''),
  };
}

export function startTeamsDispatchWorker() {
  const worker = new Worker('teams-dispatch', async (job) => {
    const { alertId, orgId } = job.data as { alertId: string; orgId: string };
    await connectDb();

    const [alert, install] = await Promise.all([
      Alert.findById(alertId).lean() as Promise<IAlert | null>,
      TeamsInstall.findOne({ org_id: orgId }).lean(),
    ]);

    if (!alert || !install) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.syntra.app';
    const actionsUrl = `${appUrl}/api/integrations/teams/actions`;
    const card = buildTeamsCard(alert, appUrl, actionsUrl);

    const botToken = decryptToken(install.bot_token_encrypted);

    if (process.env.TEAMS_APP_ID) {
      const res = await fetch(`${install.service_url}v3/conversations/${install.conversation_id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${botToken}` },
        body: JSON.stringify({
          type: 'message',
          attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: card }],
        }),
      });
      if (!res.ok) console.error('[teams-dispatch] postCard failed:', res.status, await res.text());
    } else {
      const mock = await import('@syntra/shared/mocks/teams');
      await mock.postCard(botToken, {
        serviceUrl: install.service_url,
        conversationId: install.conversation_id,
        card,
      });
    }
  }, { connection });

  worker.on('failed', (job, err) => console.error('[teams-dispatch] Job failed', job?.id, err.message));
  return worker;
}

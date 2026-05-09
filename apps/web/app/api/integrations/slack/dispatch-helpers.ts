import type { IAlert } from '@syntra/db';

const SEV_EMOJI: Record<string, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' };

export function buildSlackCard(
  alert: Pick<IAlert, '_id' | 'severity' | 'event_snapshot' | 'llm_context'>,
  appUrl: string,
) {
  const emoji = SEV_EMOJI[alert.severity] ?? '⚪';
  const alertId = String(alert._id);
  const openUrl = `${appUrl}/app/alerts/${alertId}`;

  return {
    text: `${emoji} ${alert.severity.toUpperCase()}: ${alert.event_snapshot.title}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${alert.severity.toUpperCase()}: ${alert.event_snapshot.title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: alert.event_snapshot.description },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `📍 ${alert.event_snapshot.country}  ·  📅 ${new Date(alert.event_snapshot.occurred_at).toUTCString()}`,
          },
        ],
      },
      { type: 'divider' },
      ...(alert.llm_context.why_matters
        ? [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Why this matters to your organization*\n${alert.llm_context.why_matters}`,
              },
            },
          ]
        : []),
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

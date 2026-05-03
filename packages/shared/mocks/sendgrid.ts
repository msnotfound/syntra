import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

console.warn('[MOCK] Using mock SendGrid — set SENDGRID_API_KEY in .env and restart worker to use real.');

const LOG_DIR = join(process.cwd(), 'reports', 'mock-emails');

export interface EmailPayload {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  messageId?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  mkdirSync(LOG_DIR, { recursive: true });
  const filename = `${Date.now()}-${payload.to.replace(/[^a-z0-9]/gi, '_')}.md`;
  const content = [
    `# Mock Email — ${new Date().toISOString()}`,
    `**To:** ${payload.to}`,
    `**From:** ${payload.from}`,
    `**Subject:** ${payload.subject}`,
    `**Message-ID:** ${payload.messageId ?? 'n/a'}`,
    '',
    '## HTML Body',
    '```html',
    payload.html,
    '```',
    payload.text ? `\n## Text Body\n${payload.text}` : '',
  ].join('\n');
  writeFileSync(join(LOG_DIR, filename), content);
  console.log(`[MOCK SendGrid] Email logged → reports/mock-emails/${filename}`);
}

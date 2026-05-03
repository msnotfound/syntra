import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

console.warn('[MOCK] Using mock Twilio — set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM in .env and restart worker to use real.');

const LOG_DIR = join(process.cwd(), 'reports', 'mock-whatsapp');

export interface WhatsAppPayload {
  to: string;
  from: string;
  body: string;
}

export async function sendWhatsApp(payload: WhatsAppPayload): Promise<void> {
  mkdirSync(LOG_DIR, { recursive: true });
  const filename = `${Date.now()}-${payload.to.replace(/[^0-9]/g, '')}.md`;
  const content = [
    `# Mock WhatsApp — ${new Date().toISOString()}`,
    `**To:** ${payload.to}`,
    `**From:** ${payload.from}`,
    '',
    '## Message',
    payload.body,
  ].join('\n');
  writeFileSync(join(LOG_DIR, filename), content);
  console.log(`[MOCK Twilio] WhatsApp logged → reports/mock-whatsapp/${filename}`);
}

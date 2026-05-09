import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

console.warn('[MOCK] Using mock Slack — set SLACK_CLIENT_ID / SLACK_CLIENT_SECRET / SLACK_SIGNING_SECRET in .env to use real.');

const LOG_DIR = join(process.cwd(), 'reports', 'mock-slack');

export interface SlackMessagePayload {
  channel: string;
  blocks: unknown[];
  text?: string;
}

export async function postMessage(_token: string, payload: SlackMessagePayload): Promise<void> {
  mkdirSync(LOG_DIR, { recursive: true });
  const filename = `${Date.now()}-${payload.channel.replace(/[^a-z0-9]/gi, '')}.json`;
  writeFileSync(join(LOG_DIR, filename), JSON.stringify({ token: '[REDACTED]', ...payload }, null, 2));
  console.log(`[MOCK Slack] postMessage logged → reports/mock-slack/${filename}`);
}

export async function oauthAccess(_code: string): Promise<{ access_token: string; team_id: string; team_name: string; scope: string }> {
  return { access_token: 'xoxb-mock-token', team_id: 'T_MOCK001', team_name: 'Mock Workspace', scope: 'chat:write,commands' };
}

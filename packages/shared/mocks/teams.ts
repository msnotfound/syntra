import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

console.warn('[MOCK] Using mock Teams — set TEAMS_APP_ID / TEAMS_APP_SECRET in .env to use real.');

const LOG_DIR = join(process.cwd(), 'reports', 'mock-teams');

export interface TeamsCardPayload {
  serviceUrl: string;
  conversationId: string;
  card: unknown;
}

export async function postCard(_token: string, payload: TeamsCardPayload): Promise<void> {
  mkdirSync(LOG_DIR, { recursive: true });
  const filename = `${Date.now()}-${payload.conversationId.replace(/[^a-z0-9]/gi, '')}.json`;
  writeFileSync(join(LOG_DIR, filename), JSON.stringify(payload, null, 2));
  console.log(`[MOCK Teams] postCard logged → reports/mock-teams/${filename}`);
}

export async function oauthToken(_tenantId: string, _code: string): Promise<{ access_token: string; expires_in: number }> {
  return { access_token: 'mock-teams-access-token', expires_in: 3600 };
}

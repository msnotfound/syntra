import { runDigestCycle } from './digest-shared.js';

export async function runDailyDigest(): Promise<{ orgs: number; sent: number }> {
  const since = new Date();
  since.setDate(since.getDate() - 1);
  return runDigestCycle('daily', since);
}

import { runDigestCycle } from './digest-shared.js';

export async function runWeeklyDigest(): Promise<{ orgs: number; sent: number }> {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  return runDigestCycle('weekly', since);
}

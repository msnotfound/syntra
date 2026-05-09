import { runDigestCycle } from './digest-shared.js';

export async function runMonthlyDigest(): Promise<{ orgs: number; sent: number }> {
  const since = new Date();
  since.setMonth(since.getMonth() - 1);
  return runDigestCycle('monthly', since);
}

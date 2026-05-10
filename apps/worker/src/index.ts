import dotenv from 'dotenv'; import path from 'path'; dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import cron from 'node-cron';
import { connectDb } from '@syntra/db';
import { runMatchingCycle } from './cron/matching.js';
import { runSanctionsScreeningCycle } from './cron/sanctions-screen.js';
import { runRiskScoreCycle } from './cron/risk-score.js';
import { startDispatchWorker } from './workers/dispatch.js';
import { runDailyDigest } from './cron/digest-daily.js';
import { runWeeklyDigest } from './cron/digest-weekly.js';
import { runMonthlyDigest } from './cron/digest-monthly.js';
import { startVarComputeWorker } from './workers/var-compute.js';
import { runFeedsPollCycle } from './cron/feeds-poll.js';
import { startDecisionRecordWorker } from './workers/decision-record.js';
import { runCommunityPollCycle } from './workers/community-poller.js';

async function main() {
  console.log('[worker] Starting Syntra worker...');
  await connectDb();
  console.log('[worker] DB connected');

  startDispatchWorker();
  console.log('[worker] Dispatch worker started');

  startVarComputeWorker();
  console.log('[worker] VaR compute worker started');

  startDecisionRecordWorker();
  console.log('[worker] Decision record worker started');

  // Matching cron: every 5 minutes
  const INTERVAL = process.env.DEMO_MODE === 'true' ? '*/1 * * * *' : '*/5 * * * *';
  cron.schedule(INTERVAL, async () => {
    const start = Date.now();
    try {
      const result = await runMatchingCycle();
      console.log(`[matching] processed=${result.processed} alerts_created=${result.alertsCreated} duration=${Date.now() - start}ms`);
    } catch (err) {
      console.error('[matching] Cycle error:', err);
    }
  });

  console.log('[worker] Matching cron scheduled (interval:', INTERVAL, ')');

  // Daily digest: 08:00 IST (02:30 UTC)
  cron.schedule('30 2 * * *', async () => {
    try {
      const r = await runDailyDigest();
      console.log(`[digest:daily] orgs=${r.orgs} sent=${r.sent}`);
    } catch (err) {
      console.error('[digest:daily] Error:', err);
    }
  });

  // Weekly digest: Monday 08:00 IST
  cron.schedule('30 2 * * 1', async () => {
    try {
      const r = await runWeeklyDigest();
      console.log(`[digest:weekly] orgs=${r.orgs} sent=${r.sent}`);
    } catch (err) {
      console.error('[digest:weekly] Error:', err);
    }
  });

  // Monthly digest: 1st of each month 08:00 IST
  cron.schedule('30 2 1 * *', async () => {
    try {
      const r = await runMonthlyDigest();
      console.log(`[digest:monthly] orgs=${r.orgs} sent=${r.sent}`);
    } catch (err) {
      console.error('[digest:monthly] Error:', err);
    }
  });

  console.log('[worker] Digest crons scheduled (daily 08:00 IST / weekly Mon / monthly 1st)');

  // Sanctions screening cron: daily at 02:00 UTC
  cron.schedule('0 2 * * *', async () => {
    const start = Date.now();
    try {
      const result = await runSanctionsScreeningCycle();
      console.log(
        `[sanctions] screened=${result.entitiesScreened} alerts=${result.autoAlerts} review=${result.reviewQueueEntries} duration=${Date.now() - start}ms`,
      );
    } catch (err) {
      console.error('[sanctions] Cycle error:', err);
    }
  });

  console.log('[worker] Sanctions screening cron scheduled (daily 02:00 UTC)');

  // Risk score cron: every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    const start = Date.now();
    try {
      const result = await runRiskScoreCycle();
      console.log(`[risk-score] orgs_processed=${result.orgsProcessed} duration=${Date.now() - start}ms`);
    } catch (err) {
      console.error('[risk-score] Cycle error:', err);
    }
  });

  console.log('[worker] Risk score cron scheduled (every 30 min)');

  // Feeds poll cron: every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    const start = Date.now();
    try {
      const result = await runFeedsPollCycle();
      console.log(
        `[feeds-poll] weather=${result.weather} tariffs=${result.tariffs} regulatory=${result.regulatory} ` +
        `sanctions=${result.sanctions} maritime=${result.maritime} currency=${result.currency} ` +
        `total=${result.total} duration=${Date.now() - start}ms`,
      );
    } catch (err) {
      console.error('[feeds-poll] Cycle error:', err);
    }
  });

  console.log('[worker] Feeds poll cron scheduled (every 15 min)');

  // Community sources poll: every 15 minutes (RSS sources only; webhook/push handled by API)
  cron.schedule('*/15 * * * *', async () => {
    const start = Date.now();
    try {
      const result = await runCommunityPollCycle();
      console.log(
        `[community-poll] polled=${result.polled} claims=${result.claims} errors=${result.errors} duration=${Date.now() - start}ms`,
      );
    } catch (err) {
      console.error('[community-poll] Cycle error:', err);
    }
  });

  console.log('[worker] Community sources poll cron scheduled (every 15 min)');
  console.log('[worker] Ready.');
}

main().catch(err => {
  console.error('[worker] Fatal:', err);
  process.exit(1);
});

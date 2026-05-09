import 'dotenv/config';
import cron from 'node-cron';
import { connectDb } from '@syntra/db';
import { runMatchingCycle } from './cron/matching.js';
import { runRiskScoreCycle } from './cron/risk-score.js';
import { startDispatchWorker } from './workers/dispatch.js';

async function main() {
  console.log('[worker] Starting Syntra worker...');
  await connectDb();
  console.log('[worker] DB connected');

  startDispatchWorker();
  console.log('[worker] Dispatch worker started');

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
  console.log('[worker] Ready.');
}

main().catch(err => {
  console.error('[worker] Fatal:', err);
  process.exit(1);
});

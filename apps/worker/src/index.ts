import 'dotenv/config';
import cron from 'node-cron';
import { connectDb } from '@syntra/db';
import { runMatchingCycle } from './cron/matching.js';
import { startDispatchWorker } from './workers/dispatch.js';
import { startVarComputeWorker } from './workers/var-compute.js';

async function main() {
  console.log('[worker] Starting Syntra worker...');
  await connectDb();
  console.log('[worker] DB connected');

  startDispatchWorker();
  console.log('[worker] Dispatch worker started');

  startVarComputeWorker();
  console.log('[worker] VaR compute worker started');

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
  console.log('[worker] Ready.');
}

main().catch(err => {
  console.error('[worker] Fatal:', err);
  process.exit(1);
});

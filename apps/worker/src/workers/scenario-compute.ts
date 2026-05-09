import { Queue, Worker } from 'bullmq';
import { connectDb, Scenario } from '@syntra/db';
import { computeScenario } from '@syntra/db/utils/scenario-compute.js';
import { Types } from 'mongoose';

export type { ScenarioComputeResult } from '@syntra/db/utils/scenario-compute.js';
export { computeScenario } from '@syntra/db/utils/scenario-compute.js';

const REDIS_URL = process.env.UPSTASH_REDIS_URL;
const connection = REDIS_URL
  ? { url: REDIS_URL }
  : { host: 'localhost', port: 6379 };

let scenarioQueue: Queue | null = null;

export function getScenarioComputeQueue(): Queue {
  if (!scenarioQueue) scenarioQueue = new Queue('scenario-compute', { connection });
  return scenarioQueue;
}

export function startScenarioComputeWorker() {
  const worker = new Worker('scenario-compute', async (job) => {
    const { scenarioId } = job.data as { scenarioId: string };
    await connectDb();

    const scenario = await Scenario.findById(scenarioId).lean();
    if (!scenario) return;

    const result = await computeScenario(scenario.org_id, scenario.hypothesis_events);

    await Scenario.updateOne(
      { _id: scenario._id },
      {
        $set: {
          affected_entity_ids:    result.affected_entity_ids.map((id: string) => new Types.ObjectId(id)),
          computed_var_total_usd: result.computed_var_total_usd,
          computed_at:            new Date(),
        },
      },
    );

    console.log(
      `[scenario-compute] ${scenarioId}: ${result.affected_entity_ids.length} entities, ` +
      `VaR $${result.computed_var_total_usd.toFixed(0)}`,
    );
  }, { connection });

  worker.on('failed', (job, err) =>
    console.error('[scenario-compute] Job failed', job?.id, err.message),
  );
  return worker;
}

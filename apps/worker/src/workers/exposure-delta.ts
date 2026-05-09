import { Queue, Worker } from 'bullmq';
import { connectDb, Exposure, InsurancePolicy } from '@syntra/db';
import type { IExposure } from '@syntra/db';
import mongoose from 'mongoose';
import { computeCoverageGap, computeDelta } from '../utils/exposure-math.js';
export { computeCoverageGap, computeDelta } from '../utils/exposure-math.js';

const REDIS_URL = process.env.UPSTASH_REDIS_URL;
const connection = REDIS_URL
  ? { url: REDIS_URL }
  : { host: 'localhost', port: 6379 };

let queue: Queue | null = null;

export function getExposureDeltaQueue(): Queue {
  if (!queue) queue = new Queue('exposure-delta', { connection });
  return queue;
}

export interface ExposureDeltaJobData {
  orgId: string;
  entityId: string;
  newVarUsd: number;
}

/**
 * Computes coverage_gap_usd and exposure_delta_usd for a freshly-written Exposure doc.
 * Triggered by the var-compute worker after each bulkWrite.
 */
export function startExposureDeltaWorker() {
  const worker = new Worker('exposure-delta', async (job) => {
    const { orgId, entityId, newVarUsd } = job.data as ExposureDeltaJobData;
    await connectDb();

    const orgOid = new mongoose.Types.ObjectId(orgId);
    const entityOid = new mongoose.Types.ObjectId(entityId);
    const recent = await Exposure.find({ org_id: orgOid, entity_id: entityOid })
      .sort({ computed_at: -1 })
      .limit(2)
      .lean() as IExposure[];

    if (recent.length === 0) return;

    const current = recent[0];
    const previous = recent[1] ?? null;

    const exposure_delta_usd = computeDelta(current.var_value_usd, previous?.var_value_usd ?? null);

    // Look up the linked policy to compute effective coverage.
    let insurance_coverage_pct = current.insurance_coverage_pct ?? 0;
    if (current.policy_id) {
      const policy = await InsurancePolicy.findOne({
        org_id: orgOid,
        policy_id: current.policy_id,
      }).lean();
      if (policy) {
        const effectiveCoverage = Math.max(0, policy.max_payout_usd - policy.deductible_usd);
        insurance_coverage_pct = current.var_value_usd > 0
          ? Math.min(100, (effectiveCoverage / current.var_value_usd) * 100)
          : 0;
      }
    }

    const coverage_gap_usd = computeCoverageGap(current.var_value_usd, insurance_coverage_pct);

    await Exposure.updateOne(
      { _id: current._id },
      { $set: { exposure_delta_usd, coverage_gap_usd, insurance_coverage_pct } },
    );
  }, { connection });

  worker.on('failed', (job, err) =>
    console.error('[exposure-delta] Job failed', job?.id, err.message),
  );
  return worker;
}


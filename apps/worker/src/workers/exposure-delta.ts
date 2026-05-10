import { Queue, Worker } from 'bullmq';
import { connectDb, Alert, Exposure, InsurancePolicy } from '@syntra/db';
import type { IAlert, IExposure, IInsurancePolicy } from '@syntra/db';
import mongoose from 'mongoose';
import {
  computeCoverageGap,
  computeDelta,
  computePolicyCoverage,
} from '../utils/exposure-math.js';
export { computeCoverageGap, computeDelta, computePolicyCoverage } from '../utils/exposure-math.js';

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

type LeanPolicy = IInsurancePolicy & { _id: mongoose.Types.ObjectId };

function resolvePerilKind(alert: IAlert | null): string {
  if (!alert) return 'physical_risk';
  if (alert.subtype === 'sanctions_match' || alert.subtype === 'compliance') return alert.subtype;
  return alert.event_snapshot?.event_type || alert.subtype || 'physical_risk';
}

function isPolicyActive(policy: IInsurancePolicy, now = new Date()): boolean {
  return new Date(policy.expires_at).getTime() > now.getTime();
}

function chooseApplicablePolicy(
  exposure: IExposure,
  policies: LeanPolicy[],
  perilKind: string,
): LeanPolicy | null {
  const activePolicies = policies.filter(policy => isPolicyActive(policy));
  if (exposure.policy_id) {
    return activePolicies.find(policy => policy.policy_id === exposure.policy_id) ?? null;
  }

  return activePolicies.reduce<LeanPolicy | null>((best, policy) => {
    const candidateCoverage = computePolicyCoverage({
      varUsd: exposure.var_value_usd,
      perilKind,
      policy,
    }).coverage_actual_usd;
    const bestCoverage = best
      ? computePolicyCoverage({ varUsd: exposure.var_value_usd, perilKind, policy: best }).coverage_actual_usd
      : -1;
    return candidateCoverage > bestCoverage ? policy : best;
  }, null);
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
      .lean() as unknown as IExposure[];

    if (recent.length === 0) return;

    const current = recent[0];
    const previous = recent[1] ?? null;

    const exposure_delta_usd = computeDelta(current.var_value_usd, previous?.var_value_usd ?? null);

    const alert = current.alert_id
      ? await Alert.findById(current.alert_id).lean() as unknown as IAlert | null
      : null;
    const perilKind = resolvePerilKind(alert);
    const policies = await InsurancePolicy.find({ org_id: orgOid }).lean() as unknown as LeanPolicy[];
    const policy = chooseApplicablePolicy(current, policies, perilKind);
    const coverage = computePolicyCoverage({
      varUsd: current.var_value_usd,
      perilKind,
      policy,
    });

    await Exposure.updateOne(
      { _id: current._id },
      {
        $set: {
          exposure_delta_usd,
          coverage_actual_usd: coverage.coverage_actual_usd,
          coverage_gap_usd: coverage.gap_usd,
          insurance_coverage_pct: coverage.insurance_coverage_pct,
          policy_id: policy?.policy_id ?? current.policy_id ?? null,
          exclusion_reason: coverage.exclusion_reason,
        },
      },
    );
  }, { connection });

  worker.on('failed', (job, err) =>
    console.error('[exposure-delta] Job failed', job?.id, err.message),
  );
  return worker;
}

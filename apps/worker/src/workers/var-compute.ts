import { Queue, Worker } from 'bullmq';
import { connectDb, Alert, WatchlistEntity, Exposure } from '@syntra/db';
import type { IAlert } from '@syntra/db';
import { getDisruptionFactor, computeVarUsd, simulateVarMonteCarlo, USD_TO_INR } from '@syntra/shared';
import type { AlertKind, AlertSeverity } from '@syntra/shared';
import { getExposureDeltaQueue } from './exposure-delta.js';

const REDIS_URL = process.env.UPSTASH_REDIS_URL;
const connection = REDIS_URL
  ? { url: REDIS_URL }
  : { host: 'localhost', port: 6379 };

let queue: Queue | null = null;

type VarComputeMode = 'fast' | 'simulation';

export function getVarComputeQueue(): Queue {
  if (!queue) queue = new Queue('var-compute', { connection });
  return queue;
}

export function startVarComputeWorker() {
  const worker = new Worker('var-compute', async (job) => {
    const { alertId, mode = 'fast' } = job.data as { alertId: string; mode?: VarComputeMode };
    await connectDb();

    const alert = await Alert.findById(alertId).lean() as IAlert | null;
    if (!alert) return;

    // Resolve alert kind from v3 subtype if present, otherwise infer from event_type.
    const rawSubtype = (alert as unknown as Record<string, unknown>).subtype as string | undefined;
    const kind = resolveKind(rawSubtype, alert.event_snapshot?.event_type);
    const severity = alert.severity as AlertSeverity;
    const disruption_factor = getDisruptionFactor(kind, severity);

    const entities = await WatchlistEntity.find({
      _id: { $in: alert.watchlist_entity_ids },
    }).lean();

    const now = new Date();

    const deltaJobs: Array<{ entityId: string; newVarUsd: number }> = [];
    const ops = entities.map((entity) => {
      const fastVarUsd = computeVarUsd(
        entity.annual_revenue_usd ?? null,
        entity.contribution_pct ?? null,
        disruption_factor,
      );
      const simulation = mode === 'simulation'
        ? simulateVarMonteCarlo({
            annualRevenueUsd: entity.annual_revenue_usd ?? null,
            contributionPct: entity.contribution_pct ?? null,
            kind,
            severity,
          })
        : null;

      const var_value_usd = simulation?.var_at_95 ?? fastVarUsd;
      const var_value_inr = var_value_usd * USD_TO_INR;
      const methodology = simulation?.methodology
        ?? `fast estimate; revenue × contribution_pct × disruption_factor(${kind},${severity})=${disruption_factor}`;
      deltaJobs.push({ entityId: String(entity._id), newVarUsd: var_value_usd });

      return {
        updateOne: {
          filter: { alert_id: alert._id, entity_id: entity._id },
          update: {
            $set: {
              org_id: alert.org_id,
              entity_id: entity._id,
              alert_id: alert._id,
              var_value_usd,
              var_value_inr,
              confidence_interval: 0.95,
              methodology,
              simulation: simulation
                ? {
                    ...simulation,
                    computed_at: now,
                  }
                : null,
              computed_at: now,
            },
          },
          upsert: true,
        },
      };
    });

    if (ops.length > 0) {
      await Exposure.bulkWrite(ops);
      // Enqueue delta computation for each affected entity (M30).
      const deltaQueue = getExposureDeltaQueue();
      await Promise.all(deltaJobs.map(deltaJob =>
        deltaQueue.add('compute', {
          orgId: String(alert.org_id),
          entityId: deltaJob.entityId,
          newVarUsd: deltaJob.newVarUsd,
        }),
      ));
    }
  }, { connection });

  worker.on('failed', (job, err) =>
    console.error('[var-compute] Job failed', job?.id, err.message),
  );
  return worker;
}

function resolveKind(subtype: string | undefined, event_type: string | undefined): AlertKind {
  if (subtype === 'sanctions_match') return 'sanctions_match';
  if (subtype === 'compliance') return 'compliance';
  if (subtype === 'physical_risk') return 'physical_risk';
  // Fallback: infer from event_type string if subtype not set (v1 alerts).
  if (event_type) {
    const t = event_type.toLowerCase();
    if (t.includes('sanction') || t.includes('ofac') || t.includes('embargo')) return 'sanctions_match';
    if (t.includes('compli') || t.includes('regulat') || t.includes('customs')) return 'compliance';
  }
  return 'physical_risk';
}

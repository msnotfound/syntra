import 'dotenv/config';
import { connectDb, disconnectDb } from '../connection.js';
import { Alert } from '../models/Alert.js';
import { Exposure } from '../models/Exposure.js';
import { WatchlistEntity } from '../models/WatchlistEntity.js';
import { simulatePortfolioVarMonteCarlo, type AlertKind, type AlertSeverity } from '@syntra/shared';

const BATCH_SIZE = 200;

async function migrateExposureMonteCarlo() {
  await connectDb();

  const exposures = await Exposure.find({
    $or: [
      { simulation: null },
      { simulation: { $exists: false } },
    ],
  }).lean();

  let processed = 0;
  let skipped = 0;
  const ops = [];
  const exposuresByAlertId = new Map<string, typeof exposures>();

  for (const exposure of exposures) {
    if (!exposure.alert_id) {
      skipped += 1;
      continue;
    }

    const alertId = String(exposure.alert_id);
    const groupedExposures = exposuresByAlertId.get(alertId) ?? [];
    groupedExposures.push(exposure);
    exposuresByAlertId.set(alertId, groupedExposures);
  }

  for (const [alertId, alertExposures] of exposuresByAlertId) {
    const alert = await Alert.findById(alertId).lean();
    if (!alert) {
      skipped += alertExposures.length;
      continue;
    }

    const entityIds = alertExposures.map((exposure) => exposure.entity_id);
    const entities = await WatchlistEntity.find({ _id: { $in: entityIds } }).lean();
    const entityById = new Map(entities.map((entity) => [String(entity._id), entity]));

    const kind = resolveKind(
      (alert as unknown as Record<string, unknown>).subtype as string | undefined,
      alert.event_snapshot?.event_type,
    );
    const severity = alert.severity as AlertSeverity;
    const simulatableExposures = alertExposures
      .map((exposure) => {
        const entity = entityById.get(String(exposure.entity_id));
        if (!entity) return null;

        return {
          id: String(exposure._id),
          annualRevenueUsd: entity.annual_revenue_usd ?? null,
          contributionPct: entity.contribution_pct ?? null,
          kind,
          severity,
        };
      })
      .filter((exposure) => exposure !== null);
    const portfolioSimulation = simulatePortfolioVarMonteCarlo({
      exposures: simulatableExposures,
    });
    const simulationByExposureId = new Map(
      portfolioSimulation.exposures.map((simulation) => [simulation.id, simulation]),
    );

    for (const exposure of alertExposures) {
      const simulation = simulationByExposureId.get(String(exposure._id));
      if (!simulation) {
        skipped += 1;
        continue;
      }

      ops.push({
        updateOne: {
          filter: { _id: exposure._id },
          update: {
            $set: {
              simulation: {
                ...simulation,
                computed_at: exposure.computed_at ?? new Date(),
              },
            },
          },
        },
      });
      processed += 1;

      if (ops.length >= BATCH_SIZE) {
        await Exposure.bulkWrite(ops);
        ops.length = 0;
      }
    }
  }

  if (ops.length > 0) {
    await Exposure.bulkWrite(ops);
  }

  console.log(`[migrate-exposure-monte-carlo] processed=${processed} skipped=${skipped}`);
  await disconnectDb();
}

function resolveKind(subtype: string | undefined, event_type: string | undefined): AlertKind {
  if (subtype === 'sanctions_match') return 'sanctions_match';
  if (subtype === 'compliance') return 'compliance';
  if (subtype === 'physical_risk') return 'physical_risk';

  if (event_type) {
    const t = event_type.toLowerCase();
    if (t.includes('sanction') || t.includes('ofac') || t.includes('embargo')) return 'sanctions_match';
    if (t.includes('compli') || t.includes('regulat') || t.includes('customs')) return 'compliance';
  }

  return 'physical_risk';
}

migrateExposureMonteCarlo().catch(async (err) => {
  console.error('[migrate-exposure-monte-carlo] Fatal error:', err);
  await disconnectDb();
  process.exit(1);
});

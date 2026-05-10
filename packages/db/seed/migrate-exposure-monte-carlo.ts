import 'dotenv/config';
import { connectDb, disconnectDb } from '../connection.js';
import { Alert } from '../models/Alert.js';
import { Exposure } from '../models/Exposure.js';
import { WatchlistEntity } from '../models/WatchlistEntity.js';
import { simulateVarMonteCarlo, type AlertKind, type AlertSeverity } from '@syntra/shared';

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

  for (const exposure of exposures) {
    if (!exposure.alert_id) {
      skipped += 1;
      continue;
    }

    const [alert, entity] = await Promise.all([
      Alert.findById(exposure.alert_id).lean(),
      WatchlistEntity.findById(exposure.entity_id).lean(),
    ]);

    if (!alert || !entity) {
      skipped += 1;
      continue;
    }

    const kind = resolveKind(
      (alert as unknown as Record<string, unknown>).subtype as string | undefined,
      alert.event_snapshot?.event_type,
    );
    const severity = alert.severity as AlertSeverity;
    const simulation = simulateVarMonteCarlo({
      annualRevenueUsd: entity.annual_revenue_usd ?? null,
      contributionPct: entity.contribution_pct ?? null,
      kind,
      severity,
    });

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

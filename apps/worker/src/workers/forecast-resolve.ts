/**
 * forecast-resolve — runs daily.
 *
 * For each Forecast whose expires_at has passed and actual_outcome is null:
 *   1. Search for a matching Alert within the forecast window (org_id + event_type keywords).
 *   2. Set actual_outcome = 'occurred' | 'did_not_occur'.
 *   3. Compute Brier score: bs = (p - o)^2
 *      where p = probability_pct / 100, o = 1 if occurred else 0.
 *
 * Brier score interpretation:
 *   0     → perfect calibration (e.g. p=1.0, o=1 or p=0.0, o=0)
 *   0.25  → coin-flip uncertainty (p=0.5)
 *   1     → complete miss (p=1.0, o=0)
 *   Lower is always better.
 *   Source: Brier (1950), "Verification of forecasts expressed in terms of probability."
 */

import { connectDb, Forecast, ForecastPrior, Alert } from '@syntra/db';
import type { ForecastIndicatorType, IForecast } from '@syntra/db';

// Map indicator_type → alert event_type keywords for outcome matching
const EVENT_TYPE_KEYWORDS: Record<string, string[]> = {
  'port-congestion':      ['port', 'congestion', 'blockage', 'closure'],
  'sanctions-likelihood': ['sanction', 'embargo', 'restriction', 'ofac'],
  'shipping-delay':       ['shipping', 'vessel', 'ais', 'route', 'delay', 'disruption'],
  'currency-shock':       ['currency', 'forex', 'devaluation', 'exchange'],
  'commodity-price':      ['oil', 'commodity', 'freight', 'bunker', 'fuel'],
  'geopolitical-event':   ['conflict', 'war', 'military', 'protest', 'political'],
};

/**
 * Compute Brier score for a single resolved forecast.
 * bs = (p - o)^2, p in [0,1], o in {0,1}.
 * Examples: p=0.7, o=1 → 0.09; p=0.3, o=0 → 0.09; p=0.5, o=1 → 0.25.
 */
export function computeBrierScore(probability_pct: number, occurred: boolean): number {
  const p = probability_pct / 100;
  const o = occurred ? 1 : 0;
  return Math.pow(p - o, 2);
}

async function recalibrateForecastPrior(indicatorType: ForecastIndicatorType, now: Date): Promise<void> {
  const resolved = await Forecast.find({
    indicator_type: indicatorType,
    actual_outcome: { $ne: null },
  }).select('actual_outcome brier_score').lean() as unknown as Array<Pick<IForecast, 'actual_outcome' | 'brier_score'>>;

  const sampleCount = resolved.length;
  if (sampleCount === 0) return;

  const occurredCount = resolved.filter(f => f.actual_outcome === 'occurred').length;
  const scored = resolved.filter(f => f.brier_score !== null);
  const brierAvg = scored.length > 0
    ? scored.reduce((acc, f) => acc + (f.brier_score ?? 0), 0) / scored.length
    : null;

  await ForecastPrior.findOneAndUpdate(
    { indicator_type: indicatorType },
    {
      $set: {
        base_rate: occurredCount / sampleCount,
        sample_count: sampleCount,
        brier_score_avg: brierAvg,
        updated_at: now,
      },
    },
    { upsert: true },
  );
}

export async function runForecastResolveCycle(): Promise<{ resolved: number }> {
  await connectDb();
  const now = new Date();

  const expired = await Forecast.find({
    expires_at:     { $lte: now },
    actual_outcome: null,
  }).lean() as unknown as IForecast[];

  let resolved = 0;

  for (const forecast of expired) {
    const keywords = EVENT_TYPE_KEYWORDS[forecast.indicator_type] ?? [];
    const regex = keywords.length > 0 ? new RegExp(keywords.join('|'), 'i') : null;

    // Match against the real-world event time (occurred_at), not when syntra
    // generated the alert (created_at) — alerts may land hours-to-days after
    // the underlying event, but the forecast window is about real events.
    const alertQuery: Record<string, unknown> = {
      org_id: forecast.org_id,
      'event_snapshot.occurred_at': { $gte: forecast.computed_at, $lte: forecast.expires_at },
    };
    if (regex) alertQuery['event_snapshot.event_type'] = regex;

    const match = await Alert.findOne(alertQuery).lean();
    const occurred      = match !== null;
    const actual_outcome = occurred ? 'occurred' : 'did_not_occur';
    const brier_score    = computeBrierScore(forecast.probability_pct, occurred);

    await Forecast.updateOne({ _id: forecast._id }, { $set: { actual_outcome, brier_score } });
    await recalibrateForecastPrior(forecast.indicator_type, now);
    resolved++;
  }

  return { resolved };
}

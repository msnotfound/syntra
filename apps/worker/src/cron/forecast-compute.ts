/**
 * forecast-compute — runs every 6 hours via cron.
 *
 * Steps:
 *   1. Seed LeadingIndicator docs if they don't exist.
 *   2. Recompute current_value for each of the 8 indicators from source modules.
 *   3. For indicators with threshold_breach != 'normal', generate Forecast docs
 *      per active org via packages/llm, with idempotency guard on (org, indicator, expiresAt).
 *
 * Formula conventions (all indicators):
 *   - current_value: normalised [0,1], computed over a 7-day window
 *   - baseline_value: median of 30 daily values over 90-day lookback
 *   - sigma: std dev of those 30 daily values
 *   - threshold_breach:
 *       normal   if (current - baseline) / sigma ≤ 1
 *       elevated if (current - baseline) / sigma ∈ (1, 2]
 *       critical if (current - baseline) / sigma > 2
 *   - sigma=0 → always 'normal' (no history to breach against)
 *
 * Brier score rationale: bs = (p - o)^2, p in [0,1], o in {0,1}.
 *   Source: Brier (1950), "Verification of forecasts expressed in terms of probability."
 *   Computed by forecast-resolve.ts; stored on the Forecast doc.
 */

import {
  connectDb,
  LeadingIndicator,
  seedLeadingIndicators,
  Forecast,
  Organization,
  IntelClaim,
  VesselPosition,
  Exposure,
  SanctionsList,
  WatchlistEntity,
} from '@syntra/db';
import type { ILeadingIndicator } from '@syntra/db';
import { callLLMJson, renderTemplate } from '@syntra/llm';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Time horizon for non-normal breaches
// ---------------------------------------------------------------------------
const TIME_HORIZON_BY_BREACH: Record<'elevated' | 'critical', number> = {
  elevated: 30,
  critical: 14,
};

// ---------------------------------------------------------------------------
// LLM output schema (prompt definition: specs/contract-changes/m36-1.md)
// ---------------------------------------------------------------------------
const ForecastLLMOutputSchema = z.object({
  probability_pct:    z.number().min(0).max(100),
  narrative:          z.string().max(400),
  recommended_action: z.string().max(200),
  methodology:        z.string().max(300),
});
type ForecastLLMOutput = z.infer<typeof ForecastLLMOutputSchema>;

// ---------------------------------------------------------------------------
// Statistical helpers
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stddev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  return Math.sqrt(values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length);
}

export function computeThreshold(
  current: number,
  base: number,
  sigma: number,
): ILeadingIndicator['threshold_breach'] {
  if (sigma === 0) return 'normal';
  const deviations = (current - base) / sigma;
  if (deviations > 2) return 'critical';
  if (deviations > 1) return 'elevated';
  return 'normal';
}

function computeTrend(current: number, baseline: number): 'rising' | 'stable' | 'falling' {
  if (current - baseline > 0.05) return 'rising';
  if (current - baseline < -0.05) return 'falling';
  return 'stable';
}

// ---------------------------------------------------------------------------
// Indicator formulas — one async function per indicator
// ---------------------------------------------------------------------------

/**
 * port-call-rate-anomaly
 * Fraction of vessel positions reporting stationary status in last 7 days,
 * normalised to [0,1] by the 30-day peak fraction.
 * Baseline = median of 30 daily fractions over last 90 days.
 */
async function computePortCallRateAnomaly(
  now: Date,
): Promise<{ current: number; baseline: number; sigma: number }> {
  const day7  = new Date(now.getTime() - 7  * 86400_000);
  const day30 = new Date(now.getTime() - 30 * 86400_000);
  const day90 = new Date(now.getTime() - 90 * 86400_000);
  const stationary = ['moored', 'at anchor', 'aground'];

  const cnt7  = await VesselPosition.countDocuments({ nav_status: { $in: stationary }, recorded_at: { $gte: day7 } });
  const tot7  = await VesselPosition.countDocuments({ recorded_at: { $gte: day7 } });
  const frac7 = tot7 > 0 ? cnt7 / tot7 : 0;

  const cnt30 = await VesselPosition.countDocuments({ nav_status: { $in: stationary }, recorded_at: { $gte: day30 } });
  const tot30 = await VesselPosition.countDocuments({ recorded_at: { $gte: day30 } });
  const peak  = tot30 > 0 ? cnt30 / tot30 : 0.01;

  const dailyFracs: number[] = [];
  for (let d = 0; d < 30; d++) {
    const s = new Date(day90.getTime() + d * 86400_000);
    const e = new Date(s.getTime() + 86400_000);
    const dc = await VesselPosition.countDocuments({ nav_status: { $in: stationary }, recorded_at: { $gte: s, $lt: e } });
    const dt = await VesselPosition.countDocuments({ recorded_at: { $gte: s, $lt: e } });
    dailyFracs.push(dt > 0 ? dc / dt : 0);
  }
  const base = median(dailyFracs);
  return { current: Math.min(1, frac7 / Math.max(peak, 0.01)), baseline: base, sigma: stddev(dailyFracs, base) };
}

/**
 * sanctions-list-velocity
 * 7-day delta in SanctionsList entry_count totals, normalised by 500 (max signal).
 * Baseline = median of 13 weekly normalised deltas over last 90 days.
 */
async function computeSanctionsListVelocity(
  now: Date,
): Promise<{ current: number; baseline: number; sigma: number }> {
  const day7  = new Date(now.getTime() -  7 * 86400_000);
  const day14 = new Date(now.getTime() - 14 * 86400_000);
  const day90 = new Date(now.getTime() - 90 * 86400_000);

  const recent = await SanctionsList.find({ updated_at: { $gte: day7 } }).lean();
  const prior  = await SanctionsList.find({ updated_at: { $gte: day14, $lt: day7 } }).lean();
  const delta  = Math.max(0, recent.reduce((a, l) => a + l.entry_count, 0) - prior.reduce((a, l) => a + l.entry_count, 0));
  const current = Math.min(1, delta / 500);

  const weeklyNorm: number[] = [];
  for (let w = 0; w < 13; w++) {
    const ws = new Date(day90.getTime() + w * 7 * 86400_000);
    const we = new Date(ws.getTime() + 7 * 86400_000);
    const wl = await SanctionsList.find({ updated_at: { $gte: ws, $lt: we } }).lean();
    weeklyNorm.push(Math.min(1, wl.reduce((a, l) => a + l.entry_count, 0) / 500));
  }
  const base = median(weeklyNorm);
  return { current, baseline: base, sigma: stddev(weeklyNorm, base) };
}

/**
 * shipping-deviation-frequency
 * Fraction of vessel positions with speed < 1 knot in last 7 days.
 * Baseline = median of 30 daily stopped-fractions over last 90 days.
 */
async function computeShippingDeviationFrequency(
  now: Date,
): Promise<{ current: number; baseline: number; sigma: number }> {
  const day7  = new Date(now.getTime() -  7 * 86400_000);
  const day90 = new Date(now.getTime() - 90 * 86400_000);

  const stopped = await VesselPosition.countDocuments({ speed_knots: { $lt: 1 }, recorded_at: { $gte: day7 } });
  const total   = await VesselPosition.countDocuments({ recorded_at: { $gte: day7 } });
  const current = total > 0 ? stopped / total : 0;

  const dailyRates: number[] = [];
  for (let d = 0; d < 30; d++) {
    const s = new Date(day90.getTime() + d * 86400_000);
    const e = new Date(s.getTime() + 86400_000);
    const ds = await VesselPosition.countDocuments({ speed_knots: { $lt: 1 }, recorded_at: { $gte: s, $lt: e } });
    const dt = await VesselPosition.countDocuments({ recorded_at: { $gte: s, $lt: e } });
    dailyRates.push(dt > 0 ? ds / dt : 0);
  }
  const base = median(dailyRates);
  return { current: Math.min(1, current), baseline: base, sigma: stddev(dailyRates, base) };
}

/**
 * currency-volatility
 * Std dev of |exposure_delta_usd| in last 30 days, normalised by 90-day max.
 * Baseline = median of 60 rolling 30-day std devs over the prior 90 days.
 */
async function computeCurrencyVolatility(
  now: Date,
): Promise<{ current: number; baseline: number; sigma: number }> {
  const day30 = new Date(now.getTime() - 30 * 86400_000);
  const day90 = new Date(now.getTime() - 90 * 86400_000);

  const recent = await Exposure.find({ computed_at: { $gte: day30 }, exposure_delta_usd: { $ne: null } })
    .select('exposure_delta_usd').lean();
  const vals = recent.map(e => Math.abs(e.exposure_delta_usd ?? 0));
  const mean = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const currentSd = stddev(vals, mean);

  const rollingSds: number[] = [];
  for (let d = 0; d < 60; d++) {
    const s = new Date(day90.getTime() + d * 86400_000);
    const e = new Date(s.getTime() + 30 * 86400_000);
    const w = await Exposure.find({ computed_at: { $gte: s, $lt: e }, exposure_delta_usd: { $ne: null } })
      .select('exposure_delta_usd').lean();
    const wv = w.map(x => Math.abs(x.exposure_delta_usd ?? 0));
    const wm = wv.length > 0 ? wv.reduce((a, b) => a + b, 0) / wv.length : 0;
    rollingSds.push(stddev(wv, wm));
  }
  const maxSd = Math.max(...rollingSds, currentSd, 1);
  const normSds = rollingSds.map(v => v / maxSd);
  const base = median(normSds);
  return {
    current:  Math.min(1, currentSd / maxSd),
    baseline: base,
    sigma:    stddev(normSds, base),
  };
}

const COMMODITY_RE = /(oil price|fuel surcharge|commodity|freight rate|bunker)/i;

/**
 * commodity-price-spike
 * Fraction of IntelClaims in last 7 days matching commodity keywords.
 * Baseline = median of 30 daily hit-rates over last 90 days.
 */
async function computeCommodityPriceSpike(
  now: Date,
): Promise<{ current: number; baseline: number; sigma: number }> {
  const day7  = new Date(now.getTime() -  7 * 86400_000);
  const day90 = new Date(now.getTime() - 90 * 86400_000);

  const hits  = await IntelClaim.countDocuments({ created_at: { $gte: day7 }, claim_text: COMMODITY_RE });
  const total = await IntelClaim.countDocuments({ created_at: { $gte: day7 } });
  const current = total > 0 ? hits / total : 0;

  const dailyRates: number[] = [];
  for (let d = 0; d < 30; d++) {
    const s = new Date(day90.getTime() + d * 86400_000);
    const e = new Date(s.getTime() + 86400_000);
    const dh = await IntelClaim.countDocuments({ created_at: { $gte: s, $lt: e }, claim_text: COMMODITY_RE });
    const dt = await IntelClaim.countDocuments({ created_at: { $gte: s, $lt: e } });
    dailyRates.push(dt > 0 ? dh / dt : 0);
  }
  const base = median(dailyRates);
  return { current: Math.min(1, current), baseline: base, sigma: stddev(dailyRates, base) };
}

const REGULATORY_RE = /(regulation|compliance|sanctions|export control|embargo|restriction|OFAC|EU regulation)/i;

/**
 * regulatory-mention-frequency
 * Fraction of IntelClaims in last 7 days matching regulatory keywords.
 * Baseline = median of 30 daily hit-rates over last 90 days.
 */
async function computeRegulatoryMentionFrequency(
  now: Date,
): Promise<{ current: number; baseline: number; sigma: number }> {
  const day7  = new Date(now.getTime() -  7 * 86400_000);
  const day90 = new Date(now.getTime() - 90 * 86400_000);

  const hits  = await IntelClaim.countDocuments({ created_at: { $gte: day7 }, claim_text: REGULATORY_RE });
  const total = await IntelClaim.countDocuments({ created_at: { $gte: day7 } });
  const current = total > 0 ? hits / total : 0;

  const dailyRates: number[] = [];
  for (let d = 0; d < 30; d++) {
    const s = new Date(day90.getTime() + d * 86400_000);
    const e = new Date(s.getTime() + 86400_000);
    const dh = await IntelClaim.countDocuments({ created_at: { $gte: s, $lt: e }, claim_text: REGULATORY_RE });
    const dt = await IntelClaim.countDocuments({ created_at: { $gte: s, $lt: e } });
    dailyRates.push(dt > 0 ? dh / dt : 0);
  }
  const base = median(dailyRates);
  return { current: Math.min(1, current), baseline: base, sigma: stddev(dailyRates, base) };
}

const ANOMALY_STATUSES = ['not under command', 'restricted manoeuvrability'];

/**
 * vessel-position-anomaly
 * Fraction of AIS reports with anomalous nav status in last 7 days.
 * Baseline = median of 30 daily anomaly-rates over last 90 days.
 */
async function computeVesselPositionAnomaly(
  now: Date,
): Promise<{ current: number; baseline: number; sigma: number }> {
  const day7  = new Date(now.getTime() -  7 * 86400_000);
  const day90 = new Date(now.getTime() - 90 * 86400_000);

  const anom  = await VesselPosition.countDocuments({ nav_status: { $in: ANOMALY_STATUSES }, recorded_at: { $gte: day7 } });
  const total = await VesselPosition.countDocuments({ recorded_at: { $gte: day7 } });
  const current = total > 0 ? anom / total : 0;

  const dailyRates: number[] = [];
  for (let d = 0; d < 30; d++) {
    const s = new Date(day90.getTime() + d * 86400_000);
    const e = new Date(s.getTime() + 86400_000);
    const da = await VesselPosition.countDocuments({ nav_status: { $in: ANOMALY_STATUSES }, recorded_at: { $gte: s, $lt: e } });
    const dt = await VesselPosition.countDocuments({ recorded_at: { $gte: s, $lt: e } });
    dailyRates.push(dt > 0 ? da / dt : 0);
  }
  const base = median(dailyRates);
  return { current: Math.min(1, current), baseline: base, sigma: stddev(dailyRates, base) };
}

/**
 * supplier-news-velocity
 * IntelClaim mentions of tracked supplier entities per supplier in last 7 days.
 * Normalise: 10 mentions/supplier = 1.0. Baseline = median of 30 daily values over last 90 days.
 */
async function computeSupplierNewsVelocity(
  now: Date,
): Promise<{ current: number; baseline: number; sigma: number }> {
  const day7  = new Date(now.getTime() -  7 * 86400_000);
  const day90 = new Date(now.getTime() - 90 * 86400_000);

  const suppliers = await WatchlistEntity.find({ type: 'supplier', active: true }).select('name').lean();
  const count = Math.max(suppliers.length, 1);
  const names = suppliers.map(s => s.name);
  const regex = names.length > 0
    ? new RegExp(names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i')
    : /^$/;

  const hits7 = names.length > 0
    ? await IntelClaim.countDocuments({ created_at: { $gte: day7 }, claim_text: regex })
    : 0;
  const current = Math.min(1, hits7 / count / 10);

  const dailyRates: number[] = [];
  for (let d = 0; d < 30; d++) {
    const s = new Date(day90.getTime() + d * 86400_000);
    const e = new Date(s.getTime() + 86400_000);
    const dh = names.length > 0
      ? await IntelClaim.countDocuments({ created_at: { $gte: s, $lt: e }, claim_text: regex })
      : 0;
    dailyRates.push(Math.min(1, dh / count / 10));
  }
  const base = median(dailyRates);
  return { current, baseline: base, sigma: stddev(dailyRates, base) };
}

// ---------------------------------------------------------------------------
// Dispatch table: indicator name → compute function
// ---------------------------------------------------------------------------
type ComputeFn = (now: Date) => Promise<{ current: number; baseline: number; sigma: number }>;

const COMPUTE: Record<string, ComputeFn> = {
  'port-call-rate-anomaly':       computePortCallRateAnomaly,
  'sanctions-list-velocity':      computeSanctionsListVelocity,
  'shipping-deviation-frequency': computeShippingDeviationFrequency,
  'currency-volatility':          computeCurrencyVolatility,
  'commodity-price-spike':        computeCommodityPriceSpike,
  'regulatory-mention-frequency': computeRegulatoryMentionFrequency,
  'vessel-position-anomaly':      computeVesselPositionAnomaly,
  'supplier-news-velocity':       computeSupplierNewsVelocity,
};

const INDICATOR_TYPE_MAP: Record<string, string> = {
  'port-call-rate-anomaly':       'port-congestion',
  'sanctions-list-velocity':      'sanctions-likelihood',
  'shipping-deviation-frequency': 'shipping-delay',
  'currency-volatility':          'currency-shock',
  'commodity-price-spike':        'commodity-price',
  'regulatory-mention-frequency': 'geopolitical-event',
  'vessel-position-anomaly':      'shipping-delay',
  'supplier-news-velocity':       'geopolitical-event',
};

// ---------------------------------------------------------------------------
// LLM forecast generation (prompt spec: specs/contract-changes/m36-1.md)
// ---------------------------------------------------------------------------

const FORECAST_GENERATE_SYSTEM =
  'You are a quantitative risk analyst specialising in trade supply chain risk. Return valid JSON only. Base probabilities on indicator deviation magnitudes: 1σ ≈ 35–55% probability, 2σ ≈ 60–80%. Do not exceed 85% unless the indicator is critical and multiple signals align.';

const FORECAST_GENERATE_TEMPLATE = `You are a geopolitical risk analyst. Based on the leading indicator data below, generate a probabilistic forecast.

Indicator: {{indicator_name}}
Description: {{indicator_description}}
Current level: {{current_value}} (0–1 scale)
Baseline level: {{baseline_level}} (historical median)
Sigma deviation: {{sigma_deviation}} standard deviations above baseline
Threshold breach: {{threshold_breach}}
Recent intel claims (sample): {{supporting_claims_sample}}

Generate a forecast with:
1. probability_pct: integer 0–100 representing the probability of the risk materializing within the time horizon
2. narrative: 2–3 sentence rationale citing the indicator data (max 400 chars)
3. recommended_action: single concrete action for trade operators (max 200 chars)
4. methodology: one sentence describing how the probability was derived (max 300 chars)

Return JSON only.`;

async function generateForecast(
  indicator: Pick<ILeadingIndicator, 'name' | 'description' | 'current_value' | 'baseline_value' | 'threshold_breach'>,
  sigmaDeviation: number,
  claimTexts: string[],
): Promise<ForecastLLMOutput> {
  const fallback = async (): Promise<ForecastLLMOutput> => ({
    probability_pct:    indicator.threshold_breach === 'critical' ? 72 : 48,
    narrative:          `Indicator ${indicator.name} is ${indicator.threshold_breach} at ${(indicator.current_value * 100).toFixed(0)}% of scale, ${sigmaDeviation.toFixed(1)}σ above baseline. Monitor and prepare contingency plans.`,
    recommended_action: 'Monitor daily and prepare contingency routing or sourcing options.',
    methodology:        `Probability estimated from ${sigmaDeviation.toFixed(1)}σ deviation above 90-day baseline using indicator-specific formula.`,
  });

  const msg = renderTemplate(FORECAST_GENERATE_TEMPLATE, {
    indicator_name:           indicator.name,
    indicator_description:    indicator.description,
    current_value:            indicator.current_value.toFixed(3),
    baseline_level:           indicator.baseline_value.toFixed(3),
    sigma_deviation:          sigmaDeviation.toFixed(2),
    threshold_breach:         indicator.threshold_breach,
    supporting_claims_sample: claimTexts.slice(0, 3).join(' | ') || 'No recent claims available',
  });

  try {
    const raw = await callLLMJson<ForecastLLMOutput>('claude-haiku-4-5', FORECAST_GENERATE_SYSTEM, msg, fallback);
    const parsed = ForecastLLMOutputSchema.safeParse(raw);
    return parsed.success ? parsed.data : fallback();
  } catch {
    return fallback();
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runForecastComputeCycle(): Promise<{
  indicatorsUpdated: number;
  forecastsGenerated: number;
}> {
  await connectDb();
  await seedLeadingIndicators();

  const now = new Date();
  const indicators = await LeadingIndicator.find({}).lean() as unknown as ILeadingIndicator[];
  let forecastsGenerated = 0;

  for (const indicator of indicators) {
    const computeFn = COMPUTE[indicator.name];
    if (!computeFn) continue;

    const { current, baseline, sigma } = await computeFn(now);
    const breach = computeThreshold(current, baseline, sigma);
    const trend  = computeTrend(current, baseline);

    await LeadingIndicator.updateOne(
      { _id: indicator._id },
      { $set: { current_value: current, baseline_value: baseline, sigma, threshold_breach: breach, trend, computed_at: now } },
    );

    if (breach === 'normal') continue;

    const orgs = await Organization.find({ status: 'active' }).lean();
    const sigmaDeviation = sigma > 0 ? (current - baseline) / sigma : 0;

    const recentClaims = await IntelClaim.find({ created_at: { $gte: new Date(now.getTime() - 7 * 86400_000) } })
      .sort({ created_at: -1 }).limit(5).select('claim_text').lean();
    const claimTexts = recentClaims.map(c => c.claim_text);

    const llmOut = await generateForecast(
      { ...indicator, current_value: current, baseline_value: baseline, threshold_breach: breach },
      sigmaDeviation,
      claimTexts,
    );

    const horizonDays = TIME_HORIZON_BY_BREACH[breach as 'elevated' | 'critical'];
    const expiresAt   = new Date(now.getTime() + horizonDays * 86400_000);
    const indType     = INDICATOR_TYPE_MAP[indicator.name] ?? 'geopolitical-event';

    for (const org of orgs) {
      try {
        await Forecast.findOneAndUpdate(
          { org_id: org._id, indicator_id: indicator._id, expires_at: expiresAt },
          {
            $setOnInsert: {
              org_id:             org._id,
              indicator_id:       indicator._id,
              indicator_type:     indType,
              target_entity_id:   null,
              probability_pct:    llmOut.probability_pct,
              time_horizon_days:  horizonDays,
              supporting_claims:  recentClaims.map(c => c._id),
              narrative:          llmOut.narrative,
              recommended_action: llmOut.recommended_action,
              computed_at:        now,
              expires_at:         expiresAt,
              methodology:        llmOut.methodology,
              actual_outcome:     null,
              brier_score:        null,
            },
          },
          { upsert: true, new: false },
        );
        forecastsGenerated++;
      } catch (err: unknown) {
        // Duplicate key means already generated this cycle — skip silently
        if ((err as { code?: number }).code !== 11000) throw err;
      }
    }
  }

  return { indicatorsUpdated: indicators.length, forecastsGenerated };
}

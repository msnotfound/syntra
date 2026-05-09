/**
 * @file 07-cost-caps.contract.ts
 * @description Per-plan cost caps for all paid data feeds.
 *              Single source of truth enforced at the FeedProvider level
 *              (see 06-feed-providers.contract.ts withCostGate).
 *              IMMUTABLE FROM IMPLEMENTER AGENTS — changes require a CCR.
 *
 * Hard rule: no module may bypass these caps. Every paid-feed call passes
 * through withCostGate(). Bypass attempts are CCR-violation severity.
 * The supervisor agent checks for direct paid-API fetch() calls each cycle.
 *
 * @version 1.0.0
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Plan tier
// ---------------------------------------------------------------------------

export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise';

// ---------------------------------------------------------------------------
// Plan cost caps — INR per day / per month
// ---------------------------------------------------------------------------

export interface PlanCostCap {
  /** Max INR spend on all paid feeds combined, per day. */
  feeds_total_inr_daily: number;
  /** Max INR spend on all paid feeds combined, per month. */
  feeds_total_inr_monthly: number;

  /** Max vessels tracked via AIS (MarineTraffic). 0 = feature disabled. */
  ais_vessels_max: number;
  /** Max active flight tracking entities. 0 = feature disabled. */
  flight_tracking_max: number;
  /** Max satellite observation requests per month. 0 = feature disabled. */
  satellite_observations_per_month: number;

  /** Monthly LLM spend cap in INR (covers WHY_THIS_MATTERS + RECOMMENDED_ACTIONS). */
  llm_total_inr_monthly: number;

  /** Whether M36 predictive-alerts feature is available. */
  forecast_alerts_enabled: boolean;
}

/**
 * PLAN_COST_CAPS — canonical per-plan limits.
 *
 * free: Trial orgs. No paid feeds. LLM cap is low to limit abuse.
 * starter: ₹15K/mo plan. No AIS/satellite. Basic LLM budget.
 * pro: ₹50K/mo plan (maps to 'growth' in billing). Limited AIS.
 * enterprise: Custom pricing. High limits with manual override available.
 */
export const PLAN_COST_CAPS: Record<PlanTier, PlanCostCap> = {
  free: {
    feeds_total_inr_daily: 0,
    feeds_total_inr_monthly: 0,
    ais_vessels_max: 0,
    flight_tracking_max: 0,
    satellite_observations_per_month: 0,
    llm_total_inr_monthly: 500,          // ~$6 — covers ~5K haiku calls
    forecast_alerts_enabled: false,
  },
  starter: {
    feeds_total_inr_daily: 100,          // ~$1.20/day
    feeds_total_inr_monthly: 2500,       // ~$30/month
    ais_vessels_max: 0,
    flight_tracking_max: 0,
    satellite_observations_per_month: 0,
    llm_total_inr_monthly: 2000,         // ~$24 — covers ~20K haiku calls
    forecast_alerts_enabled: false,
  },
  pro: {
    feeds_total_inr_daily: 500,          // ~$6/day
    feeds_total_inr_monthly: 12000,      // ~$145/month
    ais_vessels_max: 5,
    flight_tracking_max: 3,
    satellite_observations_per_month: 5,
    llm_total_inr_monthly: 8000,         // ~$96
    forecast_alerts_enabled: true,
  },
  enterprise: {
    feeds_total_inr_daily: 5000,         // ~$60/day — negotiated per contract
    feeds_total_inr_monthly: 100000,     // ~$1200/month
    ais_vessels_max: 50,
    flight_tracking_max: 30,
    satellite_observations_per_month: 50,
    llm_total_inr_monthly: 50000,        // ~$600
    forecast_alerts_enabled: true,
  },
} as const;

// ---------------------------------------------------------------------------
// Mapping from billing plan labels to cost-cap tier
// ---------------------------------------------------------------------------

/**
 * The billing system uses 'trial'|'starter'|'growth'|'enterprise'.
 * Cost caps use 'free'|'starter'|'pro'|'enterprise'.
 * This map bridges the two.
 */
export const BILLING_PLAN_TO_CAP_TIER: Record<
  'trial' | 'starter' | 'growth' | 'enterprise',
  PlanTier
> = {
  trial: 'free',
  starter: 'starter',
  growth: 'pro',
  enterprise: 'enterprise',
} as const;

// ---------------------------------------------------------------------------
// FeedUsage type (mirrors 06-feed-providers for convenience)
// ---------------------------------------------------------------------------

export const FeedUsageSummarySchema = z.object({
  feed_id: z.string(),
  org_id: z.string(),
  total_inr_today: z.number(),
  total_inr_month: z.number(),
  cap_inr_daily: z.number(),
  cap_inr_monthly: z.number(),
  cap_hit_today: z.boolean(),
});

export type FeedUsageSummary = z.infer<typeof FeedUsageSummarySchema>;

// ---------------------------------------------------------------------------
// LLM usage record (for monthly cap enforcement)
// ---------------------------------------------------------------------------

export const LLMUsageRecordSchema = z.object({
  org_id: z.string(),
  prompt_id: z.string(),
  prompt_version: z.string(),
  model: z.string(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  cost_inr: z.number(),
  total_inr_month: z.number(),
  created_at: z.coerce.date(),
});

export type LLMUsageRecord = z.infer<typeof LLMUsageRecordSchema>;

// ---------------------------------------------------------------------------
// Cost enforcement helper types
// ---------------------------------------------------------------------------

export type CostGateResult =
  | { allowed: true; remaining_inr_daily: number; remaining_inr_monthly: number }
  | { allowed: false; reason: 'daily_cap' | 'monthly_cap'; cap_value_inr: number };

/**
 * Signature for the checkCostGate helper that FeedProvider implementations
 * call before every external request. Must be atomic (no race conditions
 * under parallel worker execution).
 */
export interface CostGateChecker {
  check(params: {
    org_id: string;
    feed_id: string;
    estimated_cost_inr: number;
    plan_tier: PlanTier;
  }): Promise<CostGateResult>;

  recordUsage(params: {
    org_id: string;
    feed_id: string;
    actual_cost_inr: number;
  }): Promise<void>;
}

// ---------------------------------------------------------------------------
// Supervisor cost-spike alert threshold
// ---------------------------------------------------------------------------

/**
 * If aggregate daily feed spend across ALL orgs exceeds this multiplier
 * times the expected daily spend, the supervisor writes a cost-spike report.
 * See orchestration doc §13.4.
 */
export const COST_SPIKE_MULTIPLIER = 1.5 as const;

/**
 * Estimated "normal" daily INR spend across all orgs combined.
 * Supervisor uses this as the baseline. Update via CCR when customer count
 * grows materially (e.g. at 10 → 50 → 200 active orgs).
 */
export const EXPECTED_DAILY_SPEND_INR_ALL_ORGS = 2000 as const;

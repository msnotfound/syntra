/**
 * @file 03-feature-flags.contract.ts
 * @description Feature flag registry for Syntra v3 Command-tier modules.
 *              All v3 flags default to false (gated until tested and approved
 *              for a plan tier). Enable via org-level flag overrides in production.
 *              IMMUTABLE FROM IMPLEMENTER AGENTS — changes require a CCR.
 *
 * @version 1.0.0
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Plan tiers (determines which flags a customer can access)
// ---------------------------------------------------------------------------

export const PlanTierEnum = z.enum(['trial', 'starter', 'growth', 'enterprise']);
export type PlanTier = z.infer<typeof PlanTierEnum>;

// ---------------------------------------------------------------------------
// Feature flag keys
// ---------------------------------------------------------------------------

/**
 * All v3 feature flag keys. Adding a key here requires a CCR.
 * Removing a key is a breaking change — use deprecation instead.
 */
export const FEATURE_FLAG_KEYS = [
  // v3 Wave 1 — Command-tier (M17–M21)
  'sanctions_screening',   // M17: OFAC/UN/EU sanctions list cross-referencing
  'incident_triage',       // M18: Alert status + assignee + comment workflow
  'risk_heatmap',          // M20: Org risk score + regional heatmap panel
  'var_engine',            // M21: Value-at-Risk per entity + exposure view

  // v3 Wave 2 — Tier B (M22–M27)
  'custom_severity',       // M24: Per-entity severity threshold overrides
  'scheduled_digests',     // M25: Daily / weekly / monthly email digests
  'nl_watchlist',          // M27: Natural-language watchlist query parser

  // v3 Wave 1 — Supply graph (M16, Wave 2 in orchestration)
  'multi_tier_suppliers',  // M16: Tier-2/3 supplier relationships + impact chain

  // v3 Wave 2 — Scenario planner (M19)
  'scenario_planner',      // M19: Hypothetical event scenario simulation
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

// ---------------------------------------------------------------------------
// Default flag values — all false until explicitly enabled
// ---------------------------------------------------------------------------

/**
 * FEATURE_FLAGS is the canonical default state for every v3 flag.
 * Implementer agents read this to know the gating default.
 * Flag overrides for a specific org are stored in org metadata (not here).
 *
 * NEVER set a flag to `true` here without a CCR documenting the business
 * rationale and the plan tier(s) that should have access.
 */
export const FEATURE_FLAGS: Record<FeatureFlagKey, boolean> = {
  sanctions_screening: false,
  incident_triage: false,
  risk_heatmap: false,
  var_engine: false,
  custom_severity: false,
  scheduled_digests: false,
  nl_watchlist: false,
  multi_tier_suppliers: false,
  scenario_planner: false,
} as const;

// ---------------------------------------------------------------------------
// Plan-tier gating map
// ---------------------------------------------------------------------------

/**
 * Which plan tiers may access each flag when it is enabled.
 * The flag must ALSO be true in FEATURE_FLAGS (or in an org override)
 * for the gate to open. Both conditions must hold.
 */
export const FLAG_PLAN_GATES: Record<FeatureFlagKey, PlanTier[]> = {
  sanctions_screening: ['growth', 'enterprise'],
  incident_triage: ['starter', 'growth', 'enterprise'],
  risk_heatmap: ['starter', 'growth', 'enterprise'],
  var_engine: ['growth', 'enterprise'],
  custom_severity: ['growth', 'enterprise'],
  scheduled_digests: ['growth', 'enterprise'],
  nl_watchlist: ['growth', 'enterprise'],
  multi_tier_suppliers: ['growth', 'enterprise'],
  scenario_planner: ['growth', 'enterprise'],
} as const;

// ---------------------------------------------------------------------------
// Runtime flag resolver shape
// ---------------------------------------------------------------------------

/**
 * The shape that the flag-resolver helper must conform to.
 * Implementers call `isEnabled(flagKey, orgPlan)` — never read FEATURE_FLAGS
 * directly in module code (the resolver adds org-level overrides on top).
 */
export interface FeatureFlagResolver {
  isEnabled(flag: FeatureFlagKey, orgPlan: PlanTier): boolean;
  isEnabledForOrg(flag: FeatureFlagKey, orgId: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Zod schema for org-level flag override storage
// ---------------------------------------------------------------------------

export const OrgFeatureFlagOverridesSchema = z.record(
  z.enum(FEATURE_FLAG_KEYS),
  z.boolean(),
);
export type OrgFeatureFlagOverrides = z.infer<typeof OrgFeatureFlagOverridesSchema>;

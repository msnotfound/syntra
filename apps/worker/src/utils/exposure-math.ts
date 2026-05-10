/**
 * Pure math helpers for exposure delta and coverage gap computation.
 * No external deps — importable from tests without pulling in BullMQ.
 */

export function computeCoverageGap(varUsd: number, coveragePct: number): number {
  const clampedPct = Math.min(100, Math.max(0, coveragePct));
  return Math.max(0, varUsd * (1 - clampedPct / 100));
}

export function computeDelta(currentVarUsd: number, previousVarUsd: number | null): number | null {
  if (previousVarUsd === null) return null;
  return currentVarUsd - previousVarUsd;
}

export interface PolicySubLimit {
  peril_kind?: string;
  counterparty_id?: string;
  limit_usd: number;
}

export interface PolicyExclusion {
  peril_kind: string;
  reason: string;
}

export interface PolicyClaim {
  claim_id: string;
  paid_usd: number;
  denied: boolean;
  date: Date;
}

export interface CoveragePolicy {
  policy_id: string;
  max_payout_usd: number;
  deductible_usd: number;
  aggregate_limit_usd?: number | null;
  sub_limits?: PolicySubLimit[] | null;
  exclusions?: PolicyExclusion[] | null;
  claims_history?: PolicyClaim[] | null;
}

export interface PolicyCoverageInput {
  varUsd: number;
  perilKind: string;
  counterpartyId?: string | null;
  policy: CoveragePolicy | null;
}

export interface PolicyCoverageResult {
  coverage_actual_usd: number;
  gap_usd: number;
  insurance_coverage_pct: number;
  exclusion_reason: string | null;
  aggregate_remaining_usd: number;
}

export function computePaidClaims(claims: PolicyClaim[] | null | undefined): number {
  return (claims ?? []).reduce((sum, claim) => (
    claim.denied ? sum : sum + Math.max(0, claim.paid_usd)
  ), 0);
}

export function computePolicyCoverage(input: PolicyCoverageInput): PolicyCoverageResult {
  const varUsd = Math.max(0, input.varUsd);
  const noCoverage = {
    coverage_actual_usd: 0,
    gap_usd: varUsd,
    insurance_coverage_pct: 0,
    exclusion_reason: null,
    aggregate_remaining_usd: 0,
  };

  if (!input.policy || varUsd === 0) return noCoverage;

  const exclusions = input.policy.exclusions ?? [];
  const exclusion = exclusions.find(item => item.peril_kind === input.perilKind);
  if (exclusion) {
    return {
      ...noCoverage,
      exclusion_reason: exclusion.reason,
    };
  }

  const aggregateLimit = input.policy.aggregate_limit_usd ?? input.policy.max_payout_usd;
  const paidClaims = computePaidClaims(input.policy.claims_history);
  const aggregateRemaining = Math.max(0, aggregateLimit - paidClaims);
  const matchingSubLimits = (input.policy.sub_limits ?? [])
    .filter(item => (
      item.peril_kind === input.perilKind ||
      (input.counterpartyId && item.counterparty_id === input.counterpartyId)
    ))
    .map(item => Math.max(0, item.limit_usd));
  const policyLimit = Math.max(0, input.policy.max_payout_usd - input.policy.deductible_usd);
  const subLimit = matchingSubLimits.length > 0 ? Math.min(...matchingSubLimits) : policyLimit;
  const coverage_actual_usd = Math.min(varUsd, policyLimit, subLimit, aggregateRemaining);
  const gap_usd = Math.max(0, varUsd - coverage_actual_usd);
  const insurance_coverage_pct = varUsd > 0 ? Math.min(100, (coverage_actual_usd / varUsd) * 100) : 0;

  return {
    coverage_actual_usd,
    gap_usd,
    insurance_coverage_pct,
    exclusion_reason: null,
    aggregate_remaining_usd: aggregateRemaining,
  };
}

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

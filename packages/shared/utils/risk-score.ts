// REAL-LITE risk score formula for M20 Risk Heatmap.
//
// score = min(100, round(raw / NORM_FACTOR × 100))
// raw   = Σ (severity_weight × recency_decay(age))
// decay = e^(−ln2 × age_days / HALF_LIFE_DAYS)   — half-life = 7 days
// NORM_FACTOR = 25: 25 weighted-decayed contribution points maps to score 100
// (≈ 6 critical-severity alerts all fired today = full risk score)

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0.5,
};

const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;
const NORM_FACTOR = 25;

export function recencyDecay(ageMs: number): number {
  return Math.exp((-Math.LN2 * ageMs) / HALF_LIFE_MS);
}

export interface ScoredAlert {
  severity: string;
  created_at: Date;
}

export function computeRiskScore(alerts: ScoredAlert[], now = new Date()): number {
  let raw = 0;
  for (const a of alerts) {
    const w = SEVERITY_WEIGHTS[a.severity] ?? 0;
    const d = recencyDecay(now.getTime() - a.created_at.getTime());
    raw += w * d;
  }
  return Math.min(100, Math.round((raw / NORM_FACTOR) * 100));
}

export interface GroupedScoredAlert extends ScoredAlert {
  region?: string | null;
  route_entity_id?: string | null;
}

export function computeByRegion(
  alerts: GroupedScoredAlert[],
  now = new Date(),
): Record<string, number> {
  const byRegion: Record<string, GroupedScoredAlert[]> = {};
  for (const a of alerts) {
    const key = a.region ?? 'Unknown';
    (byRegion[key] ??= []).push(a);
  }
  return Object.fromEntries(
    Object.entries(byRegion).map(([k, v]) => [k, computeRiskScore(v, now)]),
  );
}

export function computeByRoute(
  alerts: GroupedScoredAlert[],
  now = new Date(),
): Record<string, number> {
  const byRoute: Record<string, GroupedScoredAlert[]> = {};
  for (const a of alerts) {
    if (!a.route_entity_id) continue;
    (byRoute[a.route_entity_id] ??= []).push(a);
  }
  return Object.fromEntries(
    Object.entries(byRoute).map(([k, v]) => [k, computeRiskScore(v, now)]),
  );
}

export function computeBySeverity(
  alerts: ScoredAlert[],
  now = new Date(),
): Record<string, number> {
  const groups: Record<string, ScoredAlert[]> = {
    critical: [], high: [], medium: [], low: [], info: [],
  };
  for (const a of alerts) {
    if (groups[a.severity]) groups[a.severity].push(a);
  }
  return Object.fromEntries(
    Object.entries(groups).map(([k, v]) => [k, computeRiskScore(v, now)]),
  );
}

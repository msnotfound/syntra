export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number) { return deg * (Math.PI / 180); }

export function pointNearPolyline(
  waypoints: Array<{ lat: number; lng: number }>,
  point: { lat: number; lng: number },
  bufferKm: number,
): boolean {
  for (let i = 0; i < waypoints.length - 1; i++) {
    if (distPointToSegmentKm(waypoints[i], waypoints[i + 1], point) <= bufferKm) return true;
  }
  return false;
}

function distPointToSegmentKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  p: { lat: number; lng: number },
): number {
  const ab = { lat: b.lat - a.lat, lng: b.lng - a.lng };
  const ap = { lat: p.lat - a.lat, lng: p.lng - a.lng };
  const lenSq = ab.lat ** 2 + ab.lng ** 2;
  if (lenSq === 0) return haversineKm(a.lat, a.lng, p.lat, p.lng);
  const t = Math.max(0, Math.min(1, (ap.lat * ab.lat + ap.lng * ab.lng) / lenSq));
  const closest = { lat: a.lat + t * ab.lat, lng: a.lng + t * ab.lng };
  return haversineKm(closest.lat, closest.lng, p.lat, p.lng);
}

export function isInQuietHours(
  now: Date,
  start: string | null,
  end: string | null,
  timezone: string,
): boolean {
  if (!start || !end) return false;
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: timezone, hour12: false });
  const parts = fmt.formatToParts(now);
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
  const current = hour * 60 + minute;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  return s <= e ? current >= s && current < e : current >= s || current < e;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

export function generateApiKey(type: 'live' | 'test'): { key: string; prefix: string } {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const rand = Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const key = `syn_${type}_${rand}`;
  return { key, prefix: key.slice(0, 16) };
}

export function apiResponse<T>(data: T) {
  return { data, meta: {}, error: null };
}

export function apiError(code: string, message: string, details?: unknown) {
  return { data: null, error: { code, message, details: details ?? null } };
}

export function severityOrder(s: string): number {
  return { critical: 4, high: 3, medium: 2, low: 1, info: 0 }[s] ?? 0;
}

// ---------------------------------------------------------------------------
// Levenshtein distance + sanctions name scoring
// ---------------------------------------------------------------------------

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Returns 0-100 match score between two name strings. */
export function nameMatchScore(a: string, b: string): number {
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 100;
  if (al.length === 0 || bl.length === 0) return 0;
  const dist = levenshtein(al, bl);
  return Math.round((1 - dist / Math.max(al.length, bl.length)) * 100);
}

export interface SanctionsEntryShape {
  name: string;
  aliases: string[];
}

/**
 * Returns the highest Levenshtein score between a set of entity name variants
 * and a sanctions entry (name + aliases).
 */
export function bestMatchScore(
  entityNames: string[],
  entry: SanctionsEntryShape,
): { score: number; matchedName: string; entityName: string } {
  const entryNames = [entry.name, ...entry.aliases];
  let best = { score: 0, matchedName: entry.name, entityName: entityNames[0] ?? '' };
  for (const eName of entityNames) {
    for (const sName of entryNames) {
      const score = nameMatchScore(eName, sName);
      if (score > best.score) best = { score, matchedName: sName, entityName: eName };
    }
  }
  return best;
}

export function meetsThreshold(alertSeverity: string, threshold: string): boolean {
  return severityOrder(alertSeverity) >= severityOrder(threshold);
}

// Plain-object entity shape used by the pure matching function.
// Intentionally has no Mongoose dependency so it is safe to import in tests.
export interface PlainEntity {
  _id: string;
  type: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  country_code: string | null;
  metadata: Record<string, unknown>;
  active: boolean;
}

import type { MatchReason } from '../schemas/index.js';

export interface MatchResult {
  entities: PlainEntity[];
  reasons: MatchReason[];
}

export function matchEventToEntities(
  event: { location: { lat: number; lng: number }; country_code: string },
  entities: PlainEntity[],
): MatchResult {
  const matched = new Map<string, { entity: PlainEntity; reasons: Set<MatchReason> }>();

  for (const entity of entities) {
    if (!entity.active) continue;
    const key = entity._id;

    // Proximity match (≤200 km haversine)
    if (entity.latitude !== null && entity.longitude !== null) {
      const dist = haversineKm(entity.latitude, entity.longitude, event.location.lat, event.location.lng);
      if (dist <= 200) {
        if (!matched.has(key)) matched.set(key, { entity, reasons: new Set() });
        matched.get(key)!.reasons.add('proximity');
      }
    }

    // Country match
    if (entity.country_code && entity.country_code === event.country_code) {
      if (!matched.has(key)) matched.set(key, { entity, reasons: new Set() });
      const reasons = matched.get(key)!.reasons;
      if (entity.type === 'country' || entity.type === 'region') {
        reasons.add('country');
      } else {
        reasons.add('supplier_country');
      }
    }

    // Route match
    if (entity.type === 'route') {
      const meta = entity.metadata as { waypoints?: Array<{ lat: number; lng: number }>; buffer_km?: number };
      const waypoints = meta.waypoints ?? [];
      const bufferKm = meta.buffer_km ?? 200;
      if (waypoints.length >= 2 && pointNearPolyline(waypoints, event.location, bufferKm)) {
        if (!matched.has(key)) matched.set(key, { entity, reasons: new Set() });
        matched.get(key)!.reasons.add('route');
      }
    }
  }

  const entitiesOut: PlainEntity[] = [];
  const reasonsOut = new Set<MatchReason>();
  for (const { entity, reasons } of matched.values()) {
    entitiesOut.push(entity);
    reasons.forEach(r => reasonsOut.add(r));
  }
  return { entities: entitiesOut, reasons: [...reasonsOut] };
}

// ---------------------------------------------------------------------------
// Severity rule override — pure function, no Mongoose dependency.
// ---------------------------------------------------------------------------

export type SeverityRuleCondition = 'event_kind' | 'event_kind+geo' | 'always';
export type SeverityRuleThreshold = 'low' | 'medium' | 'high' | 'critical';

export interface PlainSeverityRule {
  entity_id: string;
  condition_type: SeverityRuleCondition;
  event_kind: string | null;
  geo_country_code: string | null;
  threshold: SeverityRuleThreshold;
}

const SEVERITY_RULE_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

/**
 * Given a list of active rules, the matched entity IDs, and the event context,
 * returns the highest-priority override severity or defaultSeverity on no match.
 * Only upgrades severity — never downgrades.
 */
export function applySeverityOverride(
  rules: PlainSeverityRule[],
  entityIds: string[],
  eventKind: string,
  countryCode: string,
  defaultSeverity: SeverityRuleThreshold,
): SeverityRuleThreshold {
  let best = defaultSeverity;
  let bestScore = SEVERITY_RULE_ORDER[defaultSeverity] ?? 0;

  for (const rule of rules) {
    if (!entityIds.includes(rule.entity_id)) continue;

    let matches = false;
    if (rule.condition_type === 'always') {
      matches = true;
    } else if (rule.condition_type === 'event_kind') {
      matches = rule.event_kind === eventKind;
    } else if (rule.condition_type === 'event_kind+geo') {
      matches =
        rule.event_kind === eventKind &&
        (rule.geo_country_code ?? '').toUpperCase() === countryCode.toUpperCase();
    }

    if (matches) {
      const score = SEVERITY_RULE_ORDER[rule.threshold] ?? 0;
      if (score > bestScore) {
        best = rule.threshold;
        bestScore = score;
      }
    }
  }

  return best;
}

export {
  recencyDecay,
  computeRiskScore,
  computeByRegion,
  computeByRoute,
  computeBySeverity,
} from './risk-score.js';
export type { ScoredAlert, GroupedScoredAlert } from './risk-score.js';

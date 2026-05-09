/**
 * @file 04-shared-utils.contract.ts
 * @description Public utility surface for Syntra shared helpers.
 *              Mirrors packages/shared/utils/index.ts and adds v3 signatures
 *              for Command-tier spatial and financial calculations.
 *              IMMUTABLE FROM IMPLEMENTER AGENTS — changes require a CCR.
 *
 * Implementation lives in packages/shared/utils/index.ts.
 * This file declares the type signatures only — not the implementations.
 * Agents import from '@syntra/shared' (the real package); this file is the
 * authoritative specification of what that package must export.
 *
 * @version 1.0.0
 */

// ---------------------------------------------------------------------------
// Coordinate & geometry types
// ---------------------------------------------------------------------------

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Waypoint extends LatLng {}

// ---------------------------------------------------------------------------
// v1 utility signatures (already implemented in packages/shared/utils)
// ---------------------------------------------------------------------------

/**
 * Haversine great-circle distance between two points.
 * Returns distance in kilometres.
 *
 * v1 signature takes 4 scalar args.
 * v3 overload takes two LatLng objects (see below).
 */
export declare function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number;

/**
 * Returns true if `point` is within `bufferKm` of the polyline defined
 * by the ordered `waypoints` array.
 *
 * v1 implementation: packages/shared/utils/index.ts `pointNearPolyline`
 */
export declare function pointNearPolyline(
  waypoints: Waypoint[],
  point: LatLng,
  bufferKm: number,
): boolean;

export declare function isInQuietHours(
  now: Date,
  start: string | null,
  end: string | null,
  timezone: string,
): boolean;

export declare function slugify(name: string): string;

export declare function generateApiKey(type: 'live' | 'test'): {
  key: string;
  prefix: string;
};

export declare function apiResponse<T>(data: T): {
  data: T;
  meta: Record<string, never>;
  error: null;
};

export declare function apiError(
  code: string,
  message: string,
  details?: unknown,
): { data: null; error: { code: string; message: string; details: unknown } };

export declare function severityOrder(s: string): number;

export declare function meetsThreshold(alertSeverity: string, threshold: string): boolean;

// ---------------------------------------------------------------------------
// PlainEntity — entity shape safe for import in tests (no Mongoose dep)
// ---------------------------------------------------------------------------

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

export type MatchReason = 'proximity' | 'country' | 'route' | 'supplier_country';

export interface MatchResult {
  entities: PlainEntity[];
  reasons: MatchReason[];
}

export declare function matchEventToEntities(
  event: { location: LatLng; country_code: string },
  entities: PlainEntity[],
): MatchResult;

// ---------------------------------------------------------------------------
// v3 utility signatures — NEW for Command-tier modules
// ---------------------------------------------------------------------------

/**
 * Two-arg overload of haversineKm, taking LatLng objects directly.
 * Implementers may overload the existing function or create a new one named
 * `haversineKmPoints`. The contract just specifies the surface.
 *
 * @param point1 - origin coordinate
 * @param point2 - destination coordinate
 * @returns distance in kilometres
 */
export declare function haversineKmPoints(point1: LatLng, point2: LatLng): number;

/**
 * Returns true if `point` is within `marginKm` of the polyline.
 * v3 alias for `pointNearPolyline` with LatLng-based signature.
 * Introduced for Command-tier modules that prefer named parameters.
 */
export declare function withinPolyline(
  point: LatLng,
  polyline: Waypoint[],
  marginKm: number,
): boolean;

/**
 * Infers the supply-chain tier of an entity based on its id.
 * Tier 1 = direct supplier, Tier 2 = supplier-of-supplier,
 * Tier 3 = further upstream.
 *
 * Used by M16 (Multi-Tier Supplier Graph) impact propagation.
 * entityId must be a 24-char ObjectId string.
 */
export declare function inferTier(entityId: string): 1 | 2 | 3;

/**
 * Herfindahl-Hirschman Index — measures supplier concentration.
 * Input: array of market-share fractions (should sum to ≤ 1.0).
 * Output: HHI score in the range [0, 10000].
 *
 * HHI < 1500 = competitive
 * 1500–2500 = moderately concentrated
 * > 2500 = highly concentrated (single-source risk)
 *
 * Used by M21 (VaR Engine) to weight supplier-concentration risk.
 */
export declare function calculateHHI(
  suppliers: Array<{ share: number }>,
): number;

// ---------------------------------------------------------------------------
// v3 financial utility signatures (used by M21 VaR Engine)
// ---------------------------------------------------------------------------

/**
 * Converts INR amount to USD using a stored exchange rate.
 * Does NOT call an external API — uses the rate provided.
 */
export declare function inrToUsd(amountInr: number, usdInrRate: number): number;

/**
 * Converts USD amount to INR using a stored exchange rate.
 */
export declare function usdToInr(amountUsd: number, usdInrRate: number): number;

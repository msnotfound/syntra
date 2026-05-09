/**
 * @file 06-feed-providers.contract.ts
 * @description Abstract interface for all data feed providers (free and paid).
 *              Every provider — open-data or paid-API — must implement
 *              FeedProvider<TQuery, TResponse> and be registered here.
 *              IMMUTABLE FROM IMPLEMENTER AGENTS — changes require a CCR.
 *
 * Critical rule: all paid-API calls MUST go through withCostGate().
 * Direct fetch() to paid external APIs outside packages/feeds/ is a
 * CCR violation and will be flagged by the supervisor agent.
 *
 * @version 1.0.0
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Cost model
// ---------------------------------------------------------------------------

export type CostModel = 'free' | 'freemium' | 'paid';

export interface RateLimit {
  requests_per_minute: number;
  requests_per_day: number;
}

// ---------------------------------------------------------------------------
// FeedProvider abstract interface
// ---------------------------------------------------------------------------

/**
 * All data feed providers implement this interface regardless of the
 * specific external API (OFAC, UN, Reuters RSS, GDELT, MarineTraffic, etc.).
 *
 * TQuery — the input parameters accepted by this provider
 * TResponse — the normalised response shape this provider returns
 */
export interface FeedProvider<TQuery, TResponse> {
  readonly id: FeedProviderId;
  readonly name: string;
  readonly cost_model: CostModel;
  /** Cost in INR per API call. 0 for free providers. */
  readonly cost_per_request_inr: number;
  readonly rate_limit: RateLimit;

  /**
   * Execute a data fetch.
   * For paid providers, always call withCostGate() before calling fetch().
   * Throws FeedProviderError if the provider is unavailable or returns an error.
   */
  fetch(query: TQuery, opts: { org_id: string }): Promise<TResponse>;

  /**
   * Return static mock data for the given query.
   * Used when: cap is hit, provider is unreachable in test env, unit tests.
   * Must never return an empty result — always return realistic placeholder data.
   */
  getMockData(query: TQuery): TResponse;

  /**
   * Estimate the INR cost of a query without executing it.
   * Used by the pre-call cost gate to decide whether to proceed.
   */
  estimateCost(query: TQuery): number;

  /**
   * Returns a cost-gated version of this provider.
   * The gated provider checks org daily spend BEFORE each fetch() call.
   * If cap would be exceeded, throws FeedCapExceededError and returns mock data.
   *
   * Implementation lives in packages/feeds/withCostGate.ts.
   * This signature is the contract — do not bypass.
   */
  withCostGate(opts: {
    org_id: string;
    cap_inr_daily: number;
  }): FeedProvider<TQuery, TResponse>;
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class FeedProviderError extends Error {
  constructor(
    public readonly provider_id: FeedProviderId,
    message: string,
    public readonly retriable: boolean = true,
  ) {
    super(`[${provider_id}] ${message}`);
    this.name = 'FeedProviderError';
  }
}

export class FeedCapExceededError extends Error {
  constructor(
    public readonly provider_id: FeedProviderId,
    public readonly org_id: string,
    public readonly cap_inr_daily: number,
  ) {
    super(
      `[${provider_id}] Daily INR cap of ${cap_inr_daily} exceeded for org ${org_id}. Mock data returned.`,
    );
    this.name = 'FeedCapExceededError';
  }
}

// ---------------------------------------------------------------------------
// Canonical provider IDs
// ---------------------------------------------------------------------------

/**
 * All registered feed provider IDs. Adding a new provider requires a CCR.
 */
export const FEED_PROVIDER_IDS = [
  // Sanctions / compliance (free, public)
  'ofac-sanctions',      // OFAC SDN list — US Treasury
  'un-sanctions',        // UN Security Council consolidated list
  'eu-sanctions',        // EU Restricted Parties list

  // News / event feeds (free)
  'reuters-rss',         // Reuters RSS feed for geopolitical news
  'gdelt',               // GDELT Global Knowledge Graph (open data, high volume)

  // Paid feeds (Wave 3 — gated by customer pull + FeedCapExceededError)
  'marinetraffic-ais',   // MarineTraffic AIS vessel positions (M34)
  'flightaware',         // FlightAware flight tracking (M34)
  'sentinel-hub',        // ESA Sentinel Hub satellite imagery (M34)
  'aviationstack',       // AviationStack flight data (M34)
] as const;

export type FeedProviderId = (typeof FEED_PROVIDER_IDS)[number];

// ---------------------------------------------------------------------------
// Provider metadata registry
// ---------------------------------------------------------------------------

export interface FeedProviderMeta {
  id: FeedProviderId;
  name: string;
  cost_model: CostModel;
  cost_per_request_inr: number;
  rate_limit: RateLimit;
  requires_api_key: boolean;
  wave: 1 | 2 | 3;   // orchestration wave in which this provider is activated
}

export const FEED_PROVIDER_REGISTRY: Record<FeedProviderId, FeedProviderMeta> = {
  'ofac-sanctions': {
    id: 'ofac-sanctions',
    name: 'OFAC SDN List',
    cost_model: 'free',
    cost_per_request_inr: 0,
    rate_limit: { requests_per_minute: 60, requests_per_day: 5000 },
    requires_api_key: false,
    wave: 1,
  },
  'un-sanctions': {
    id: 'un-sanctions',
    name: 'UN Security Council Consolidated List',
    cost_model: 'free',
    cost_per_request_inr: 0,
    rate_limit: { requests_per_minute: 30, requests_per_day: 1000 },
    requires_api_key: false,
    wave: 1,
  },
  'eu-sanctions': {
    id: 'eu-sanctions',
    name: 'EU Restrictive Measures (Sanctions Map)',
    cost_model: 'free',
    cost_per_request_inr: 0,
    rate_limit: { requests_per_minute: 30, requests_per_day: 1000 },
    requires_api_key: false,
    wave: 1,
  },
  'reuters-rss': {
    id: 'reuters-rss',
    name: 'Reuters RSS (Geopolitics + Trade)',
    cost_model: 'free',
    cost_per_request_inr: 0,
    rate_limit: { requests_per_minute: 10, requests_per_day: 500 },
    requires_api_key: false,
    wave: 1,
  },
  gdelt: {
    id: 'gdelt',
    name: 'GDELT Global Knowledge Graph',
    cost_model: 'free',
    cost_per_request_inr: 0,
    rate_limit: { requests_per_minute: 60, requests_per_day: 10000 },
    requires_api_key: false,
    wave: 1,
  },
  'marinetraffic-ais': {
    id: 'marinetraffic-ais',
    name: 'MarineTraffic AIS Vessel Positions',
    cost_model: 'paid',
    cost_per_request_inr: 8,      // ~$0.10 per vessel query
    rate_limit: { requests_per_minute: 10, requests_per_day: 500 },
    requires_api_key: true,
    wave: 3,
  },
  flightaware: {
    id: 'flightaware',
    name: 'FlightAware FlightXML3',
    cost_model: 'paid',
    cost_per_request_inr: 6,      // ~$0.07 per query
    rate_limit: { requests_per_minute: 15, requests_per_day: 500 },
    requires_api_key: true,
    wave: 3,
  },
  'sentinel-hub': {
    id: 'sentinel-hub',
    name: 'ESA Sentinel Hub (Satellite Imagery)',
    cost_model: 'paid',
    cost_per_request_inr: 40,     // ~$0.50 per processing unit
    rate_limit: { requests_per_minute: 5, requests_per_day: 100 },
    requires_api_key: true,
    wave: 3,
  },
  aviationstack: {
    id: 'aviationstack',
    name: 'AviationStack Real-Time Flights',
    cost_model: 'freemium',
    cost_per_request_inr: 0,      // free tier; paid tiers apply above quota
    rate_limit: { requests_per_minute: 5, requests_per_day: 100 },
    requires_api_key: true,
    wave: 3,
  },
} as const;

// ---------------------------------------------------------------------------
// feed_usage collection schema (logged by withCostGate on every paid call)
// ---------------------------------------------------------------------------

export const FeedUsageSchema = z.object({
  _id: z.string(),
  feed_id: z.enum(FEED_PROVIDER_IDS),
  org_id: z.string(),
  query_hash: z.string(),          // SHA-256 of the query params (for dedup)
  cost_inr: z.number(),
  total_inr_today: z.number(),     // running daily total for this org + feed
  total_inr_month: z.number(),     // running monthly total for this org + feed
  cap_hit: z.boolean(),            // true if this call caused the cap to be reached
  created_at: z.coerce.date(),
});

export type FeedUsage = z.infer<typeof FeedUsageSchema>;

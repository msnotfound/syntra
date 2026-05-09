import type { ISanctionsEntry } from '@syntra/db';

// Structural types matching 06-feed-providers.contract.ts (FeedProvider interface)
type CostModel = 'free' | 'freemium' | 'paid';
interface RateLimit { requests_per_minute: number; requests_per_day: number }
type FeedProviderId =
  | 'ofac-sanctions' | 'un-sanctions' | 'eu-sanctions'
  | 'reuters-rss' | 'gdelt'
  | 'marinetraffic-ais' | 'flightaware' | 'sentinel-hub' | 'aviationstack';

interface FeedProvider<TQuery, TResponse> {
  readonly id: FeedProviderId;
  readonly name: string;
  readonly cost_model: CostModel;
  readonly cost_per_request_inr: number;
  readonly rate_limit: RateLimit;
  fetch(query: TQuery, opts: { org_id: string }): Promise<TResponse>;
  getMockData(query: TQuery): TResponse;
  estimateCost(query: TQuery): number;
  withCostGate(opts: { org_id: string; cap_inr_daily: number }): FeedProvider<TQuery, TResponse>;
}

type OfacQuery = { list_name?: string };
type OfacResponse = ISanctionsEntry[];

const MOCK_ENTRIES: ISanctionsEntry[] = [
  {
    name: 'AL-RASHIDI TRADING COMPANY',
    aliases: ['Al Rashidi Trading', 'Al-Rashidy Trading Co', 'ARTC'],
    country: 'IR',
    dob: null,
    id_numbers: ['TRD-IR-00421'],
    programs: ['IRAN', 'SDGT'],
    source_url: 'https://sanctionssearch.ofac.treas.gov/',
  },
  {
    name: 'SALAMI, Hossein',
    aliases: ['Hosein Salami', 'Hussein Salami', 'SALAMI Hossein'],
    country: 'IR',
    dob: '1963-03-14',
    id_numbers: ['IRGC-CMD-001'],
    programs: ['IRAN', 'IRGC'],
    source_url: 'https://sanctionssearch.ofac.treas.gov/',
  },
  {
    name: 'PERSIAN GULF SHIPPING LLC',
    aliases: ['PGS LLC', 'Persian Gulf Ship', 'Gulf Shipping Persian'],
    country: 'AE',
    dob: null,
    id_numbers: ['IMO-9234567'],
    programs: ['IRAN', 'NPWMD'],
    source_url: 'https://sanctionssearch.ofac.treas.gov/',
  },
];

export class OfacSanctionsProvider implements FeedProvider<OfacQuery, OfacResponse> {
  readonly id: FeedProviderId = 'ofac-sanctions';
  readonly name = 'OFAC SDN List';
  readonly cost_model: CostModel = 'free';
  readonly cost_per_request_inr = 0;
  readonly rate_limit: RateLimit = { requests_per_minute: 60, requests_per_day: 5000 };

  async fetch(query: OfacQuery, _opts: { org_id: string }): Promise<OfacResponse> {
    const feedUrl = process.env.OFAC_FEED_URL;
    if (!feedUrl) {
      console.warn('[ofac-provider] OFAC_FEED_URL not set — using mock data');
      return this.getMockData(query);
    }

    try {
      const res = await fetch(feedUrl, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`OFAC feed returned ${res.status}`);
      const json = await res.json() as { entries?: ISanctionsEntry[] };
      return json.entries ?? [];
    } catch (err) {
      console.error('[ofac-provider] Fetch failed, falling back to mock:', err);
      return this.getMockData(query);
    }
  }

  getMockData(_query: OfacQuery): OfacResponse {
    return MOCK_ENTRIES;
  }

  estimateCost(_query: OfacQuery): number {
    return 0;
  }

  withCostGate(_opts: { org_id: string; cap_inr_daily: number }): FeedProvider<OfacQuery, OfacResponse> {
    // OFAC is a free provider — no cost gate needed.
    return this;
  }
}

export const ofacProvider = new OfacSanctionsProvider();

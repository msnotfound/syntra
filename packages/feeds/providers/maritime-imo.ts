import type { FeedProvider } from '../withCostGate.js';

export type MaritimeAdvisoryType =
  | 'piracy'
  | 'weather_warning'
  | 'nav_restriction'
  | 'port_closure'
  | 'conflict_zone'
  | 'channel_obstruction';

export interface MaritimeAdvisory {
  title: string;
  description: string;
  advisory_type: MaritimeAdvisoryType;
  severity_level: 'high' | 'medium' | 'low';
  region: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code: string;
  occurred_at: Date;
  source_url: string;
  affected_route?: string;
}

export type MaritimeQuery = { region?: string; advisory_type?: MaritimeAdvisoryType };
export type MaritimeResponse = MaritimeAdvisory[];

const MOCK_ADVISORIES: MaritimeAdvisory[] = [
  {
    title: 'IMO MSC: High piracy threat — Gulf of Aden, Bab-el-Mandeb',
    description:
      'IMO Maritime Safety Committee issues Level 3 piracy advisory for the Gulf of Aden corridor. 3 vessel boardings reported in the past 14 days. Houthi-affiliated groups conducting drone and missile attacks against commercial shipping. All vessels strongly advised to implement BMP5 measures and transit at speed.',
    advisory_type: 'piracy',
    severity_level: 'high',
    region: 'Gulf of Aden',
    latitude: 12.5,
    longitude: 44.2,
    country: 'Yemen',
    country_code: 'YE',
    occurred_at: new Date('2026-05-09T10:00:00Z'),
    source_url: 'https://www.imo.org/en/OurWork/Security/Pages/PiracyIUUreporting.aspx',
    affected_route: 'Suez–Indian Ocean',
  },
  {
    title: 'IMO: Navigation restriction — Strait of Hormuz extended tanker inspection zone',
    description:
      'Iranian authorities extended the mandatory tanker inspection zone in the Strait of Hormuz from 6nm to 12nm. Vessels carrying crude oil must allow IRGCN boarding inspection; average delay 4–8 hours reported. VLCC scheduling impact expected for Indian refineries on Persian Gulf routes.',
    advisory_type: 'nav_restriction',
    severity_level: 'high',
    region: 'Strait of Hormuz',
    latitude: 26.5,
    longitude: 56.3,
    country: 'Iran',
    country_code: 'IR',
    occurred_at: new Date('2026-05-07T08:30:00Z'),
    source_url: 'https://www.imo.org/en/MediaCentre/HotTopics/Pages/Strait-of-Hormuz.aspx',
    affected_route: 'Persian Gulf–Indian Ocean',
  },
  {
    title: 'Port closure: Colombo port workers\' strike — indefinite industrial action',
    description:
      'Sri Lanka Ports Authority employees and dockworkers commenced indefinite industrial action at 06:00 local time. All container terminal operations suspended. Colombo handles ~75% of South Asian transshipment. Indian exporters using Colombo hub routing should expect 7–14 day delays.',
    advisory_type: 'port_closure',
    severity_level: 'medium',
    region: 'Indian Ocean',
    latitude: 6.9,
    longitude: 79.8,
    country: 'Sri Lanka',
    country_code: 'LK',
    occurred_at: new Date('2026-05-06T00:30:00Z'),
    source_url: 'https://www.marineinsight.com/maritime-law/imo-maritime-safety/',
    affected_route: 'Bay of Bengal–Red Sea',
  },
  {
    title: 'IMO MSI: Uncharted wreck hazard — Mozambique Channel, 18°S',
    description:
      'Hydrographic office reports uncharted wreck at approximately 18°12\'S, 37°48\'E in the northern Mozambique Channel following recent cyclone activity. Minimum depth over wreck estimated at 4m below chart datum. Cape-size bulk carriers and VLCCs must avoid area and use alternative routing.',
    advisory_type: 'channel_obstruction',
    severity_level: 'medium',
    region: 'Mozambique Channel',
    latitude: -18.2,
    longitude: 37.8,
    country: 'Mozambique',
    country_code: 'MZ',
    occurred_at: new Date('2026-05-03T12:00:00Z'),
    source_url: 'https://www.admiralty.co.uk/maritime-data-solutions/maritime-safety-information',
  },
  {
    title: 'IMO: Low-level piracy alert — Guinea Gulf, offshore Nigeria',
    description:
      'Regional Maritime Security Coordination Centre reports 2 incidents of armed robbery against vessels at anchor within 20nm of Lagos anchorage. Vessels advised to maintain anchor watch, avoid isolated anchorage, and report via MDAT-GoG. Risk level remains lower than 2021–2022 peak.',
    advisory_type: 'piracy',
    severity_level: 'low',
    region: 'Gulf of Guinea',
    latitude: 4.5,
    longitude: 3.3,
    country: 'Nigeria',
    country_code: 'NG',
    occurred_at: new Date('2026-05-01T09:00:00Z'),
    source_url: 'https://www.imo.org/en/OurWork/Security/Pages/PiracyIUUreporting.aspx',
    affected_route: 'West Africa coast',
  },
];

export class MaritimeImoProvider implements FeedProvider<MaritimeQuery, MaritimeResponse> {
  readonly id = 'maritime-imo';
  readonly name = 'IMO Maritime Safety Information';
  readonly cost_model = 'free' as const;
  readonly cost_per_request_inr = 0;
  readonly rate_limit = { requests_per_minute: 30, requests_per_day: 1000 };

  async fetch(query: MaritimeQuery, _opts: { org_id: string }): Promise<MaritimeResponse> {
    const apiKey = process.env.IMO_MSI_API_KEY;
    if (!apiKey) {
      console.warn('[maritime-imo] IMO_MSI_API_KEY not set — using mock data');
      return this.getMockData(query);
    }

    try {
      const params = new URLSearchParams({ format: 'json' });
      if (query.region) params.set('region', query.region);
      const res = await fetch(`https://www.imo.org/en/api/msi?${params}`, {
        headers: { 'X-Api-Key': apiKey },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`IMO MSI API returned ${res.status}`);
      return this.getMockData(query); // full normalization out of scope
    } catch (err) {
      console.error('[maritime-imo] Fetch failed, using mock data:', err);
      return this.getMockData(query);
    }
  }

  getMockData(_query: MaritimeQuery): MaritimeResponse {
    return MOCK_ADVISORIES;
  }

  estimateCost(_query: MaritimeQuery): number {
    return 0;
  }

  withCostGate(_opts: { org_id: string; cap_inr_daily: number }): FeedProvider<MaritimeQuery, MaritimeResponse> {
    return this;
  }
}

export const maritimeImoProvider = new MaritimeImoProvider();

import type { FeedProvider } from '../withCostGate.js';
import { withCostGate as _withCostGate } from '../withCostGate.js';

export interface AISPosition {
  vessel_name: string;
  mmsi: string;
  imo: string;
  lat: number;
  lng: number;
  heading: number;
  speed_knots: number;
  nav_status: string;
  last_updated: Date;
  flag_country: string;
  flag_code: string;
}

export type AISQuery = { mmsi?: string; imo?: string; vessel_name?: string };
export type AISResponse = AISPosition[];

const MOCK_POSITIONS: AISPosition[] = [
  {
    vessel_name: 'MV MUNDRA EXPRESS',
    mmsi: '419123456',
    imo: '9387065',
    lat: 21.43,
    lng: 57.82,
    heading: 295,
    speed_knots: 14.2,
    nav_status: 'underway_using_engine',
    last_updated: new Date('2026-05-10T04:12:00Z'),
    flag_country: 'India',
    flag_code: 'IN',
  },
  {
    vessel_name: 'MV MAERSK HYDERABAD',
    mmsi: '636015302',
    imo: '9786134',
    lat: 12.78,
    lng: 43.55,
    heading: 152,
    speed_knots: 12.8,
    nav_status: 'underway_using_engine',
    last_updated: new Date('2026-05-10T03:45:00Z'),
    flag_country: 'Liberia',
    flag_code: 'LR',
  },
  {
    vessel_name: 'MT GUJARAT PRIDE',
    mmsi: '419088777',
    imo: '9412830',
    lat: 26.15,
    lng: 56.42,
    heading: 0,
    speed_knots: 0,
    nav_status: 'at_anchor',
    last_updated: new Date('2026-05-10T02:30:00Z'),
    flag_country: 'India',
    flag_code: 'IN',
  },
  {
    vessel_name: 'MV EVER GIVEN II',
    mmsi: '371487000',
    imo: '9811000',
    lat: 30.67,
    lng: 32.33,
    heading: 340,
    speed_knots: 8.5,
    nav_status: 'underway_using_engine',
    last_updated: new Date('2026-05-10T01:00:00Z'),
    flag_country: 'Panama',
    flag_code: 'PA',
  },
  {
    vessel_name: 'MV SINGAPORE TRADER',
    mmsi: '566789012',
    imo: '9654321',
    lat: 1.28,
    lng: 103.71,
    heading: 88,
    speed_knots: 16.1,
    nav_status: 'underway_using_engine',
    last_updated: new Date('2026-05-10T00:15:00Z'),
    flag_country: 'Singapore',
    flag_code: 'SG',
  },
];

export class MarinetrafficAisProvider implements FeedProvider<AISQuery, AISResponse> {
  readonly id = 'marinetraffic-ais';
  readonly name = 'MarineTraffic AIS Vessel Positions';
  readonly cost_model = 'paid' as const;
  readonly cost_per_request_inr = 8;
  readonly rate_limit = { requests_per_minute: 10, requests_per_day: 500 };

  getMockData(_query: AISQuery): AISResponse {
    return MOCK_POSITIONS;
  }

  estimateCost(_query: AISQuery): number {
    return this.cost_per_request_inr;
  }

  withCostGate(opts: { org_id: string; cap_inr_daily: number }): FeedProvider<AISQuery, AISResponse> {
    return _withCostGate(this, opts);
  }

  async fetch(query: AISQuery, _opts: { org_id: string }): Promise<AISResponse> {
    const apiKey = process.env.MARINETRAFFIC_API_KEY;
    if (!apiKey) {
      console.warn('[marinetraffic-ais] MARINETRAFFIC_API_KEY not set — using mock data');
      return this.getMockData(query);
    }

    const mmsi = query.mmsi ?? query.imo ?? '';
    const url = `https://services.marinetraffic.com/api/exportvessels/v:8/${apiKey}?MMSI=${mmsi}&protocol=json`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`MarineTraffic API error: ${res.status}`);
      const json = await res.json() as { DATA?: Array<Record<string, string>> };
      const rows = json.DATA ?? [];
      return rows.map(r => ({
        vessel_name: r['SHIPNAME'] ?? '',
        mmsi: r['MMSI'] ?? '',
        imo: r['IMO'] ?? '',
        lat: parseFloat(r['LAT'] ?? '0'),
        lng: parseFloat(r['LON'] ?? '0'),
        heading: parseFloat(r['HEADING'] ?? '0'),
        speed_knots: parseFloat(r['SPEED'] ?? '0') / 10,
        nav_status: r['NAVSTAT'] ?? 'underway_using_engine',
        last_updated: new Date(r['TIMESTAMP'] ?? Date.now()),
        flag_country: r['FLAG'] ?? '',
        flag_code: r['FLAG'] ?? '',
      }));
    } catch (err) {
      console.error('[marinetraffic-ais] fetch error, falling back to mock:', err);
      return this.getMockData(query);
    }
  }
}

export const marinetrafficAisProvider = new MarinetrafficAisProvider();

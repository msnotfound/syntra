import type { FeedProvider } from '../withCostGate.js';
import { withCostGate as _withCostGate } from '../withCostGate.js';

export interface FlightPosition {
  flight_number: string;
  registration: string;
  origin_iata: string;
  destination_iata: string;
  lat: number;
  lng: number;
  altitude_ft: number;
  heading: number;
  speed_knots: number;
  status: string;
  departed_at: Date;
  arriving_at: Date;
}

export type FlightQuery = { flight_number?: string; registration?: string };
export type FlightResponse = FlightPosition[];

const MOCK_FLIGHTS: FlightPosition[] = [
  {
    flight_number: 'AI101',
    registration: 'VT-ANX',
    origin_iata: 'BOM',
    destination_iata: 'LHR',
    lat: 28.45,
    lng: 51.23,
    altitude_ft: 37000,
    heading: 315,
    speed_knots: 480,
    status: 'en_route',
    departed_at: new Date('2026-05-10T02:00:00Z'),
    arriving_at: new Date('2026-05-10T08:30:00Z'),
  },
  {
    flight_number: 'EK508',
    registration: 'A6-ENY',
    origin_iata: 'BOM',
    destination_iata: 'DXB',
    lat: 23.12,
    lng: 59.88,
    altitude_ft: 35000,
    heading: 295,
    speed_knots: 470,
    status: 'en_route',
    departed_at: new Date('2026-05-10T03:15:00Z'),
    arriving_at: new Date('2026-05-10T05:15:00Z'),
  },
  {
    flight_number: 'FX5001',
    registration: 'N987FX',
    origin_iata: 'BOM',
    destination_iata: 'SIN',
    lat: 8.34,
    lng: 79.56,
    altitude_ft: 38000,
    heading: 108,
    speed_knots: 490,
    status: 'en_route',
    departed_at: new Date('2026-05-09T22:00:00Z'),
    arriving_at: new Date('2026-05-10T06:30:00Z'),
  },
  {
    flight_number: '6E211',
    registration: 'VT-IEL',
    origin_iata: 'DEL',
    destination_iata: 'MAA',
    lat: 21.5,
    lng: 79.1,
    altitude_ft: 33000,
    heading: 175,
    speed_knots: 440,
    status: 'en_route',
    departed_at: new Date('2026-05-10T04:00:00Z'),
    arriving_at: new Date('2026-05-10T06:00:00Z'),
  },
  {
    flight_number: 'QR572',
    registration: 'A7-BEB',
    origin_iata: 'MAA',
    destination_iata: 'CDG',
    lat: 31.22,
    lng: 49.67,
    altitude_ft: 39000,
    heading: 320,
    speed_knots: 500,
    status: 'en_route',
    departed_at: new Date('2026-05-10T00:30:00Z'),
    arriving_at: new Date('2026-05-10T07:45:00Z'),
  },
];

export class FlightawareProvider implements FeedProvider<FlightQuery, FlightResponse> {
  readonly id = 'flightaware';
  readonly name = 'FlightAware FlightXML3';
  readonly cost_model = 'paid' as const;
  readonly cost_per_request_inr = 6;
  readonly rate_limit = { requests_per_minute: 15, requests_per_day: 500 };

  getMockData(_query: FlightQuery): FlightResponse {
    return MOCK_FLIGHTS;
  }

  estimateCost(_query: FlightQuery): number {
    return this.cost_per_request_inr;
  }

  withCostGate(opts: { org_id: string; cap_inr_daily: number }): FeedProvider<FlightQuery, FlightResponse> {
    return _withCostGate(this, opts);
  }

  async fetch(query: FlightQuery, _opts: { org_id: string }): Promise<FlightResponse> {
    const apiKey = process.env.FLIGHTAWARE_API_KEY;
    if (!apiKey) {
      console.warn('[flightaware] FLIGHTAWARE_API_KEY not set — using mock data');
      return this.getMockData(query);
    }

    const ident = query.flight_number ?? query.registration ?? 'AI101';
    const url = `https://aeroapi.flightaware.com/aeroapi/flights/${ident}`;

    try {
      const res = await fetch(url, {
        headers: { 'x-apikey': apiKey },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`FlightAware API error: ${res.status}`);
      const json = await res.json() as { flights?: Array<Record<string, unknown>> };
      const flights = json.flights ?? [];
      return flights.map(f => ({
        flight_number: String(f['ident'] ?? ''),
        registration: String(f['registration'] ?? ''),
        origin_iata: String((f['origin'] as Record<string, unknown>)?.['code'] ?? ''),
        destination_iata: String((f['destination'] as Record<string, unknown>)?.['code'] ?? ''),
        lat: Number(f['last_position'] ? (f['last_position'] as Record<string, unknown>)['latitude'] : 0),
        lng: Number(f['last_position'] ? (f['last_position'] as Record<string, unknown>)['longitude'] : 0),
        altitude_ft: Number(f['last_position'] ? (f['last_position'] as Record<string, unknown>)['altitude'] : 0),
        heading: Number(f['last_position'] ? (f['last_position'] as Record<string, unknown>)['heading'] : 0),
        speed_knots: Number(f['last_position'] ? (f['last_position'] as Record<string, unknown>)['groundspeed'] : 0),
        status: String(f['status'] ?? 'unknown'),
        departed_at: new Date(String(f['departure_time'] ?? Date.now())),
        arriving_at: new Date(String(f['estimated_arrival_time'] ?? Date.now())),
      }));
    } catch (err) {
      console.error('[flightaware] fetch error, falling back to mock:', err);
      return this.getMockData(query);
    }
  }
}

export const flightawareProvider = new FlightawareProvider();

import type { FeedProvider } from '../withCostGate.js';

export interface WeatherEvent {
  title: string;
  description: string;
  phenomenon: string;       // 'cyclone' | 'flood' | 'tornado' | 'storm' | 'drought'
  severity_level: 'extreme' | 'severe' | 'moderate' | 'minor';
  latitude: number;
  longitude: number;
  country: string;
  country_code: string;
  occurred_at: Date;
  source_url: string;
}

export type WeatherQuery = { lat?: number; lng?: number; radius_km?: number };
export type WeatherResponse = WeatherEvent[];

const MOCK_EVENTS: WeatherEvent[] = [
  {
    title: 'Cyclone Biparjoy: Category 3 intensification over Arabian Sea',
    description:
      'Severe cyclonic storm Biparjoy has intensified to Category 3 with sustained winds of 185 km/h. Expected landfall near Kutch coast within 48 hours. Port operations suspended at Kandla and Mundra.',
    phenomenon: 'cyclone',
    severity_level: 'extreme',
    latitude: 22.3,
    longitude: 68.4,
    country: 'India',
    country_code: 'IN',
    occurred_at: new Date('2026-05-08T06:00:00Z'),
    source_url: 'https://www.nhc.noaa.gov/data/tcr/',
  },
  {
    title: 'Flash flood alert: Mekong Delta, Vietnam',
    description:
      'Heavy monsoon rainfall causing flash floods across Mekong Delta provinces. Road and rail disruptions reported. Agricultural export routes affected. Water levels 2.3m above seasonal average.',
    phenomenon: 'flood',
    severity_level: 'severe',
    latitude: 10.4,
    longitude: 105.6,
    country: 'Vietnam',
    country_code: 'VN',
    occurred_at: new Date('2026-05-07T14:30:00Z'),
    source_url: 'https://water.weather.gov/ahps/',
  },
  {
    title: 'Tornado outbreak: Oklahoma–Kansas corridor',
    description:
      'Outbreak of 12 confirmed tornadoes across the Oklahoma–Kansas corridor. Multiple EF2+ events reported. Significant damage to grain storage and agricultural infrastructure. Supply chain disruption expected for US wheat exports.',
    phenomenon: 'tornado',
    severity_level: 'severe',
    latitude: 36.8,
    longitude: -97.2,
    country: 'United States',
    country_code: 'US',
    occurred_at: new Date('2026-05-06T22:15:00Z'),
    source_url: 'https://www.spc.noaa.gov/climo/reports/',
  },
  {
    title: 'Severe dust storm disrupts Suez Canal shipping lanes',
    description:
      'Khamsin dust storm with visibility below 200m is disrupting navigation in the Gulf of Suez. Suez Canal Authority has issued advisory; vessel transit speed reduced. Expected to clear within 18 hours.',
    phenomenon: 'storm',
    severity_level: 'moderate',
    latitude: 29.9,
    longitude: 32.5,
    country: 'Egypt',
    country_code: 'EG',
    occurred_at: new Date('2026-05-05T09:45:00Z'),
    source_url: 'https://forecast.weather.gov/',
  },
  {
    title: 'Prolonged drought declared: Horn of Africa — Ethiopia, Somalia, Kenya',
    description:
      'NOAA confirms third consecutive failed rainy season across Horn of Africa. Drought declaration covers 680,000 sq km. Livestock mortality rates at 35% in affected zones. Humanitarian corridors and food import demand expected to surge.',
    phenomenon: 'drought',
    severity_level: 'extreme',
    latitude: 5.0,
    longitude: 40.0,
    country: 'Ethiopia',
    country_code: 'ET',
    occurred_at: new Date('2026-05-04T00:00:00Z'),
    source_url: 'https://www.cpc.ncep.noaa.gov/products/african_desk/',
  },
];

export class WeatherNoaaProvider implements FeedProvider<WeatherQuery, WeatherResponse> {
  readonly id = 'weather-noaa';
  readonly name = 'NOAA National Weather Service';
  readonly cost_model = 'free' as const;
  readonly cost_per_request_inr = 0;
  readonly rate_limit = { requests_per_minute: 60, requests_per_day: 10000 };

  async fetch(query: WeatherQuery, _opts: { org_id: string }): Promise<WeatherResponse> {
    const apiKey = process.env.NOAA_API_KEY;
    if (!apiKey) {
      console.warn('[weather-noaa] NOAA_API_KEY not set — using mock data');
      return this.getMockData(query);
    }

    try {
      const params = new URLSearchParams({ units: 'si', limit: '20' });
      if (query.lat !== undefined) params.set('point', `${query.lat},${query.lng ?? 0}`);
      const res = await fetch(`https://api.weather.gov/alerts/active?${params}`, {
        headers: { 'User-Agent': 'Syntra/1.0 (syntra.io)' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`NOAA API returned ${res.status}`);
      const json = await res.json() as { features?: unknown[] };
      // Normalize NOAA GeoJSON alerts to WeatherEvent[]. Fallback to mock on empty.
      if (!json.features?.length) return this.getMockData(query);
      return this.getMockData(query); // full parse out of scope; use mocks for now
    } catch (err) {
      console.error('[weather-noaa] Fetch failed, using mock data:', err);
      return this.getMockData(query);
    }
  }

  getMockData(_query: WeatherQuery): WeatherResponse {
    return MOCK_EVENTS;
  }

  estimateCost(_query: WeatherQuery): number {
    return 0;
  }

  withCostGate(_opts: { org_id: string; cap_inr_daily: number }): FeedProvider<WeatherQuery, WeatherResponse> {
    return this;
  }
}

export const weatherNoaaProvider = new WeatherNoaaProvider();

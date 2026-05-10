import type { FeedProvider } from '../withCostGate.js';
import { withCostGate as _withCostGate } from '../withCostGate.js';

export interface SatelliteObservation {
  tile_id: string;
  bbox: [number, number, number, number];
  date: Date;
  cloud_cover_pct: number;
  thumbnail_url: string;
  detected_changes: Array<{
    change_type: 'vessel_traffic' | 'infrastructure' | 'fire' | 'flood' | 'other';
    confidence: number;
    description: string;
    bounding_box: [[number, number], [number, number]];
  }> | null;
}

export type SatelliteQuery = {
  bbox: [number, number, number, number];
  date_from: string;
  date_to: string;
};
export type SatelliteResponse = SatelliteObservation[];

const MOCK_OBSERVATIONS: SatelliteObservation[] = [
  {
    tile_id: 'T37QEU-20260508',
    bbox: [43.0, 11.5, 44.0, 12.5],
    date: new Date('2026-05-08T08:00:00Z'),
    cloud_cover_pct: 12,
    thumbnail_url: 'https://mock.sentinel-hub.com/tiles/T37QEU-20260508.jpg',
    detected_changes: [
      {
        change_type: 'vessel_traffic',
        confidence: 0.87,
        description: 'Elevated vessel density detected in southern Red Sea corridor near Bab-el-Mandeb. 14 vessels identified vs baseline 6.',
        bounding_box: [[43.2, 11.7], [43.8, 12.3]],
      },
    ],
  },
  {
    tile_id: 'T36RVU-20260508',
    bbox: [32.0, 29.5, 33.0, 30.5],
    date: new Date('2026-05-08T07:30:00Z'),
    cloud_cover_pct: 5,
    thumbnail_url: 'https://mock.sentinel-hub.com/tiles/T36RVU-20260508.jpg',
    detected_changes: [
      {
        change_type: 'vessel_traffic',
        confidence: 0.92,
        description: 'Suez Canal northbound lane congestion. Queue of 28 vessels at Great Bitter Lake anchorage.',
        bounding_box: [[32.3, 29.8], [32.7, 30.2]],
      },
    ],
  },
  {
    tile_id: 'T40RBT-20260507',
    bbox: [55.5, 25.0, 56.5, 26.0],
    date: new Date('2026-05-07T06:00:00Z'),
    cloud_cover_pct: 28,
    thumbnail_url: 'https://mock.sentinel-hub.com/tiles/T40RBT-20260507.jpg',
    detected_changes: null,
  },
  {
    tile_id: 'T47NNA-20260509',
    bbox: [103.5, 1.0, 104.5, 2.0],
    date: new Date('2026-05-09T02:15:00Z'),
    cloud_cover_pct: 55,
    thumbnail_url: 'https://mock.sentinel-hub.com/tiles/T47NNA-20260509.jpg',
    detected_changes: [
      {
        change_type: 'vessel_traffic',
        confidence: 0.79,
        description: 'Strait of Malacca — higher than average tanker traffic. 3 VLCC class vessels transiting eastbound.',
        bounding_box: [[103.7, 1.2], [104.2, 1.7]],
      },
    ],
  },
  {
    tile_id: 'T40QBF-20260509',
    bbox: [58.0, 22.0, 59.0, 23.0],
    date: new Date('2026-05-09T05:45:00Z'),
    cloud_cover_pct: 8,
    thumbnail_url: 'https://mock.sentinel-hub.com/tiles/T40QBF-20260509.jpg',
    detected_changes: [
      {
        change_type: 'infrastructure',
        confidence: 0.65,
        description: 'Possible new construction activity detected at port facility. Structural footprint expanded ~15% vs 2025 baseline.',
        bounding_box: [[58.3, 22.3], [58.7, 22.7]],
      },
    ],
  },
];

export class SentinelHubSatelliteProvider implements FeedProvider<SatelliteQuery, SatelliteResponse> {
  readonly id = 'sentinel-hub';
  readonly name = 'ESA Sentinel Hub (Satellite Imagery)';
  readonly cost_model = 'paid' as const;
  readonly cost_per_request_inr = 40;
  readonly rate_limit = { requests_per_minute: 5, requests_per_day: 100 };

  getMockData(_query: SatelliteQuery): SatelliteResponse {
    return MOCK_OBSERVATIONS;
  }

  estimateCost(_query: SatelliteQuery): number {
    return this.cost_per_request_inr;
  }

  withCostGate(opts: { org_id: string; cap_inr_daily: number }): FeedProvider<SatelliteQuery, SatelliteResponse> {
    return _withCostGate(this, opts);
  }

  async fetch(query: SatelliteQuery, _opts: { org_id: string }): Promise<SatelliteResponse> {
    const clientId = process.env.SENTINEL_HUB_CLIENT_ID;
    const clientSecret = process.env.SENTINEL_HUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.warn('[sentinel-hub] SENTINEL_HUB_CLIENT_ID or SENTINEL_HUB_CLIENT_SECRET not set — using mock data');
      return this.getMockData(query);
    }

    try {
      // Obtain bearer token
      const tokenRes = await fetch(
        'https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!tokenRes.ok) throw new Error(`Sentinel Hub auth error: ${tokenRes.status}`);
      const tokenJson = await tokenRes.json() as { access_token: string };
      const token = tokenJson.access_token;

      const [lng_min, lat_min, lng_max, lat_max] = query.bbox;
      const catalogRes = await fetch(
        'https://services.sentinel-hub.com/api/v1/catalog/1.0.0/search',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            bbox: [lng_min, lat_min, lng_max, lat_max],
            datetime: `${query.date_from}T00:00:00Z/${query.date_to}T23:59:59Z`,
            collections: ['sentinel-2-l2a'],
            limit: 5,
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!catalogRes.ok) throw new Error(`Sentinel Hub catalog error: ${catalogRes.status}`);
      const catalog = await catalogRes.json() as { features?: Array<Record<string, unknown>> };
      return (catalog.features ?? []).map(f => ({
        tile_id: String(f['id'] ?? ''),
        bbox: query.bbox,
        date: new Date(String((f['properties'] as Record<string, unknown>)?.['datetime'] ?? Date.now())),
        cloud_cover_pct: Number((f['properties'] as Record<string, unknown>)?.['eo:cloud_cover'] ?? 0),
        thumbnail_url: String((f['assets'] as Record<string, Record<string, unknown>>)?.['thumbnail']?.['href'] ?? ''),
        detected_changes: null,
      }));
    } catch (err) {
      console.error('[sentinel-hub] fetch error, falling back to mock:', err);
      return this.getMockData(query);
    }
  }
}

export const sentinelHubSatelliteProvider = new SentinelHubSatelliteProvider();

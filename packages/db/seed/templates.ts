// Onboarding templates — 5 sector presets
export interface TemplateEntity {
  type: 'supplier' | 'port' | 'route' | 'country' | 'region' | 'asset';
  name: string;
  latitude: number | null;
  longitude: number | null;
  country_code: string | null;
  region: string | null;
  metadata: Record<string, unknown>;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  sector: string;
  entities: TemplateEntity[];
}

export const TEMPLATES: Template[] = [
  {
    id: 'indian-pharma-africa',
    name: 'Indian Pharma Exporter to Africa',
    description: 'Covers key routes, ports, and destination countries for pharmaceutical exports from India to East and West Africa.',
    sector: 'Pharmaceuticals',
    entities: [
      { type: 'port', name: 'JNPT', latitude: 18.9480, longitude: 72.9481, country_code: 'IN', region: 'Indian Ocean', metadata: { unlocode: 'INNSA' } },
      { type: 'port', name: 'Mombasa Port', latitude: -4.0435, longitude: 39.6682, country_code: 'KE', region: 'East Africa', metadata: { unlocode: 'KEMBA' } },
      { type: 'route', name: 'India → East Africa via Suez', latitude: null, longitude: null, country_code: null, region: 'Red Sea / Suez', metadata: { buffer_km: 200, waypoints: [{ lat: 18.9480, lng: 72.9481 }, { lat: 14.7956, lng: 42.9494 }, { lat: -1.2921, lng: 36.8219 }] } },
      { type: 'country', name: 'Kenya', latitude: -1.2921, longitude: 36.8219, country_code: 'KE', region: 'East Africa', metadata: {} },
      { type: 'country', name: 'Nigeria', latitude: 9.0820, longitude: 8.6753, country_code: 'NG', region: 'West Africa', metadata: {} },
      { type: 'country', name: 'South Africa', latitude: -30.5595, longitude: 22.9375, country_code: 'ZA', region: 'Southern Africa', metadata: {} },
      { type: 'region', name: 'Red Sea', latitude: 20.0, longitude: 38.0, country_code: null, region: 'Red Sea', metadata: {} },
      { type: 'region', name: 'Suez Canal', latitude: 30.5, longitude: 32.3, country_code: 'EG', region: 'North Africa', metadata: {} },
    ],
  },
  {
    id: 'indian-textile-mena',
    name: 'Indian Textile Exporter to MENA',
    description: 'Covers Persian Gulf routes, Gulf ports, and key MENA markets for textile and garment exporters.',
    sector: 'Textiles & Garments',
    entities: [
      { type: 'port', name: 'Mundra Port', latitude: 22.8390, longitude: 69.7040, country_code: 'IN', region: 'Indian Ocean', metadata: { unlocode: 'INMUN' } },
      { type: 'route', name: 'India → Gulf via Persian Gulf', latitude: null, longitude: null, country_code: null, region: 'Persian Gulf', metadata: { buffer_km: 200, waypoints: [{ lat: 22.8390, lng: 69.7040 }, { lat: 25.2048, lng: 55.2708 }] } },
      { type: 'country', name: 'UAE', latitude: 23.4241, longitude: 53.8478, country_code: 'AE', region: 'Gulf', metadata: {} },
      { type: 'country', name: 'Saudi Arabia', latitude: 23.8859, longitude: 45.0792, country_code: 'SA', region: 'Gulf', metadata: {} },
      { type: 'country', name: 'Egypt', latitude: 26.8206, longitude: 30.8025, country_code: 'EG', region: 'North Africa', metadata: {} },
      { type: 'region', name: 'Persian Gulf', latitude: 26.0, longitude: 52.0, country_code: null, region: 'Persian Gulf', metadata: {} },
    ],
  },
  {
    id: 'indian-autoparts-sea',
    name: 'Indian Auto Parts Exporter — SE Asia + Eastern Europe',
    description: 'Covers key routes and markets for auto component manufacturers exporting to Southeast Asia and Eastern Europe.',
    sector: 'Automotive Components',
    entities: [
      { type: 'port', name: 'Chennai Port', latitude: 13.0827, longitude: 80.2946, country_code: 'IN', region: 'Indian Ocean', metadata: { unlocode: 'INMAA' } },
      { type: 'country', name: 'Thailand', latitude: 15.8700, longitude: 100.9925, country_code: 'TH', region: 'Southeast Asia', metadata: {} },
      { type: 'country', name: 'Vietnam', latitude: 14.0583, longitude: 108.2772, country_code: 'VN', region: 'Southeast Asia', metadata: {} },
      { type: 'country', name: 'Poland', latitude: 51.9194, longitude: 19.1451, country_code: 'PL', region: 'Eastern Europe', metadata: {} },
      { type: 'country', name: 'Ukraine', latitude: 48.3794, longitude: 31.1656, country_code: 'UA', region: 'Eastern Europe', metadata: {} },
      { type: 'region', name: 'Black Sea', latitude: 43.0, longitude: 34.0, country_code: null, region: 'Eastern Europe', metadata: {} },
    ],
  },
  {
    id: 'freight-forwarder-gulf',
    name: 'Mid-Market Freight Forwarder — India↔Gulf',
    description: 'Key ports, routes, and country coverage for logistics operators handling India–Gulf cargo.',
    sector: 'Freight Forwarding',
    entities: [
      { type: 'port', name: 'Dubai Port (Jebel Ali)', latitude: 25.0113, longitude: 55.0741, country_code: 'AE', region: 'Gulf', metadata: { unlocode: 'AEJEA' } },
      { type: 'port', name: 'JNPT', latitude: 18.9480, longitude: 72.9481, country_code: 'IN', region: 'Indian Ocean', metadata: { unlocode: 'INNSA' } },
      { type: 'route', name: 'India → Gulf via Persian Gulf', latitude: null, longitude: null, country_code: null, region: 'Persian Gulf', metadata: { buffer_km: 200, waypoints: [{ lat: 18.9480, lng: 72.9481 }, { lat: 25.0113, lng: 55.0741 }] } },
      { type: 'country', name: 'UAE', latitude: 23.4241, longitude: 53.8478, country_code: 'AE', region: 'Gulf', metadata: {} },
      { type: 'country', name: 'Oman', latitude: 21.4735, longitude: 55.9754, country_code: 'OM', region: 'Gulf', metadata: {} },
      { type: 'region', name: 'Gulf of Oman', latitude: 23.0, longitude: 59.0, country_code: null, region: 'Gulf', metadata: {} },
    ],
  },
  {
    id: 'trade-finance-africa',
    name: 'Trade Finance Bank — Sub-Saharan Africa',
    description: 'Country and corridor coverage for banks providing trade finance facilities into Sub-Saharan African markets.',
    sector: 'Trade Finance / Banking',
    entities: [
      { type: 'country', name: 'Kenya', latitude: -1.2921, longitude: 36.8219, country_code: 'KE', region: 'East Africa', metadata: {} },
      { type: 'country', name: 'Nigeria', latitude: 9.0820, longitude: 8.6753, country_code: 'NG', region: 'West Africa', metadata: {} },
      { type: 'country', name: 'Ghana', latitude: 7.9465, longitude: -1.0232, country_code: 'GH', region: 'West Africa', metadata: {} },
      { type: 'country', name: 'Tanzania', latitude: -6.3690, longitude: 34.8888, country_code: 'TZ', region: 'East Africa', metadata: {} },
      { type: 'country', name: 'Ethiopia', latitude: 9.1450, longitude: 40.4897, country_code: 'ET', region: 'East Africa', metadata: {} },
      { type: 'country', name: 'Sudan', latitude: 12.8628, longitude: 30.2176, country_code: 'SD', region: 'East Africa', metadata: {} },
      { type: 'region', name: 'Sahel', latitude: 15.0, longitude: 15.0, country_code: null, region: 'Sahel', metadata: {} },
    ],
  },
];

export interface SectorTemplateRow {
  type: 'supplier' | 'port' | 'route' | 'country' | 'region' | 'asset';
  name: string;
  country_code: string | null;
  region: string | null;
  supplier_tier: 1 | 2 | 3 | null;
  metadata: Record<string, unknown>;
}

interface SectorTemplate {
  sector_key: string;
  display_name: string;
  prefilled_entities: SectorTemplateRow[];
}

const TEMPLATES: SectorTemplate[] = [
  {
    sector_key: 'pharma',
    display_name: 'Pharmaceuticals / Life Sciences',
    prefilled_entities: [
      { type: 'country', name: 'China', country_code: 'CN', region: 'East Asia', supplier_tier: 1, metadata: { note: 'Major API source country' } },
      { type: 'country', name: 'India', country_code: 'IN', region: 'South Asia', supplier_tier: 1, metadata: { note: 'Formulation hub' } },
      { type: 'port', name: 'Nhava Sheva (JNPT)', country_code: 'IN', region: 'South Asia', supplier_tier: null, metadata: { iata: 'INNSA' } },
      { type: 'region', name: 'Strait of Hormuz', country_code: null, region: 'Middle East', supplier_tier: null, metadata: { note: 'Critical chokepoint for API imports' } },
    ],
  },
  {
    sector_key: 'textiles',
    display_name: 'Textiles / Apparel / Garments',
    prefilled_entities: [
      { type: 'country', name: 'Bangladesh', country_code: 'BD', region: 'South Asia', supplier_tier: 1, metadata: { note: 'Garment manufacturing hub' } },
      { type: 'country', name: 'Vietnam', country_code: 'VN', region: 'Southeast Asia', supplier_tier: 1, metadata: { note: 'Apparel export leader' } },
      { type: 'port', name: 'Chittagong Port', country_code: 'BD', region: 'South Asia', supplier_tier: null, metadata: { iata: 'BDCGP' } },
      { type: 'port', name: 'Ho Chi Minh City Port', country_code: 'VN', region: 'Southeast Asia', supplier_tier: null, metadata: {} },
    ],
  },
  {
    sector_key: 'engineering',
    display_name: 'Engineering / Auto Components / Manufacturing',
    prefilled_entities: [
      { type: 'country', name: 'China', country_code: 'CN', region: 'East Asia', supplier_tier: 1, metadata: { note: 'Components and raw materials' } },
      { type: 'country', name: 'South Korea', country_code: 'KR', region: 'East Asia', supplier_tier: 2, metadata: { note: 'Advanced components' } },
      { type: 'port', name: 'Shanghai Port', country_code: 'CN', region: 'East Asia', supplier_tier: null, metadata: { note: 'Worlds largest container port' } },
      { type: 'region', name: 'South China Sea', country_code: null, region: 'Southeast Asia', supplier_tier: null, metadata: { note: 'High-transit shipping corridor' } },
    ],
  },
  {
    sector_key: 'it_services',
    display_name: 'IT Services / Software',
    prefilled_entities: [
      { type: 'country', name: 'United States', country_code: 'US', region: 'North America', supplier_tier: 1, metadata: { note: 'Primary revenue market' } },
      { type: 'country', name: 'United Kingdom', country_code: 'GB', region: 'Europe', supplier_tier: 2, metadata: { note: 'Secondary market' } },
      { type: 'country', name: 'Singapore', country_code: 'SG', region: 'Southeast Asia', supplier_tier: 2, metadata: { note: 'APAC hub' } },
    ],
  },
  {
    sector_key: 'agri_commodities',
    display_name: 'Agriculture / Commodities / Food',
    prefilled_entities: [
      { type: 'country', name: 'Ukraine', country_code: 'UA', region: 'Eastern Europe', supplier_tier: 1, metadata: { note: 'Grain and sunflower oil supplier' } },
      { type: 'country', name: 'Brazil', country_code: 'BR', region: 'South America', supplier_tier: 1, metadata: { note: 'Soy, sugar, coffee' } },
      { type: 'port', name: 'Odesa Port', country_code: 'UA', region: 'Eastern Europe', supplier_tier: null, metadata: { note: 'Black Sea grain corridor' } },
      { type: 'region', name: 'Black Sea', country_code: null, region: 'Eastern Europe', supplier_tier: null, metadata: { note: 'Key commodity transit route' } },
    ],
  },
];

const SECTOR_KEY_MAP: Record<string, string> = {
  pharma: 'pharma',
  pharmaceutical: 'pharma',
  'life sciences': 'pharma',
  textile: 'textiles',
  textiles: 'textiles',
  apparel: 'textiles',
  garment: 'textiles',
  garments: 'textiles',
  engineering: 'engineering',
  manufacturing: 'engineering',
  automotive: 'engineering',
  'auto components': 'engineering',
  it: 'it_services',
  'it services': 'it_services',
  software: 'it_services',
  technology: 'it_services',
  'information technology': 'it_services',
  agriculture: 'agri_commodities',
  agri: 'agri_commodities',
  commodities: 'agri_commodities',
  food: 'agri_commodities',
  'food processing': 'agri_commodities',
};

export function getTemplateForSector(sector: string | null): SectorTemplateRow[] {
  if (!sector) return [];
  const key = SECTOR_KEY_MAP[sector.toLowerCase().trim()];
  if (!key) return [];
  return TEMPLATES.find(t => t.sector_key === key)?.prefilled_entities ?? [];
}

export function listTemplates(): Array<{ sector_key: string; display_name: string }> {
  return TEMPLATES.map(({ sector_key, display_name }) => ({ sector_key, display_name }));
}

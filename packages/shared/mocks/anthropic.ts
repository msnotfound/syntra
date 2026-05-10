console.warn('[MOCK] Using mock Anthropic — set ANTHROPIC_API_KEY in .env and restart worker to use real.');

const STUB_WHY_MATTERS = [
  'This event falls within 200km of your watchlist entity and may disrupt your supply chain.',
  'The affected region overlaps with your active shipping route.',
  'Your registered country watchlist includes the affected jurisdiction.',
];

const STUB_ACTIONS = [
  'Review your shipment schedule for the next 7 days in this corridor.',
  'Contact your freight forwarder for alternative routing options.',
  'Notify your insurance broker to assess war-risk premium impact.',
];

export interface AnthropicMockResult {
  whyMatters: string;
  recommendedActions: string[];
}

export interface NLWatchlistParseOutput {
  entity_types: string[];
  countries: string[];
  regions: string[];
  keywords: string[];
  severity_threshold: 'critical' | 'high' | 'medium' | 'low' | null;
  summary: string;
  confidence: number;
}

export async function generateAlertContext(
  _eventTitle: string,
  _affectedEntities: string[],
  _orgIndustry: string,
): Promise<AnthropicMockResult> {
  await delay(100);
  return {
    whyMatters: STUB_WHY_MATTERS[Math.floor(Math.random() * STUB_WHY_MATTERS.length)],
    recommendedActions: STUB_ACTIONS,
  };
}

export async function parseNLWatchlist(
  _userQuery: string,
  _availableEntityTypes: string[],
  _availableRegions: string[],
): Promise<NLWatchlistParseOutput> {
  await delay(50);
  return {
    entity_types: ['supplier'],
    countries: ['IN'],
    regions: [],
    keywords: ['India'],
    severity_threshold: null,
    summary: 'Track suppliers in India',
    confidence: 0.85,
  };
}

export interface CompanyMetadataExtractOutput {
  company_name: string | null;
  sector: string | null;
  country: string | null;
  region: string | null;
  suppliers: Array<{ name: string; confidence: number; excerpt: string }>;
  customers: Array<{ name: string; confidence: number; excerpt: string }>;
  facilities: Array<{ name: string; location: string | null; confidence: number; excerpt: string }>;
  counterparties: Array<{ name: string; type: 'supplier' | 'customer' | 'partner' | 'competitor' | null; confidence: number; excerpt: string }>;
}

export async function extractCompanyMetadata(
  inputText: string,
  _inputSource: 'webpage' | 'annual_report',
): Promise<CompanyMetadataExtractOutput> {
  await delay(200);
  const hasSupplier = inputText.toLowerCase().includes('supplier') || inputText.toLowerCase().includes('source');
  const hasCustomer = inputText.toLowerCase().includes('customer') || inputText.toLowerCase().includes('export') || inputText.toLowerCase().includes('market');

  return {
    company_name: 'Example Company Ltd.',
    sector: 'Manufacturing & Exports',
    country: 'IN',
    region: 'South Asia',
    suppliers: hasSupplier ? [
      { name: 'Raw Materials Supplier A', confidence: 0.75, excerpt: 'Primary supplier of raw materials from Southeast Asia' },
      { name: 'Component Provider B', confidence: 0.65, excerpt: 'Secondary supplier based in South Asia' },
    ] : [],
    customers: hasCustomer ? [
      { name: 'Major Export Market US', confidence: 0.8, excerpt: 'Primary export destination in North America' },
      { name: 'European Distribution Partner', confidence: 0.7, excerpt: 'Secondary customer base in EU' },
    ] : [],
    facilities: [
      { name: 'Manufacturing Plant - Bangalore', location: 'Bangalore, KA, IN', confidence: 0.85, excerpt: 'Main manufacturing facility' },
      { name: 'Logistics Hub - Mumbai Port', location: 'Mumbai, MH, IN', confidence: 0.7, excerpt: 'Export logistics coordination center' },
    ],
    counterparties: [
      { name: 'Shipping Partner XYZ', type: 'partner', confidence: 0.75, excerpt: 'Logistics and shipping partner' },
      { name: 'Component Supplier A', type: 'supplier', confidence: 0.7, excerpt: 'Strategic component supplier' },
    ],
  };
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

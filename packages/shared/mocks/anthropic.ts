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

export interface AltRouteSuggestionOutput {
  alternatives: Array<{
    route_name: string;
    via: string;
    extra_days: number;
    cost_delta_pct: number | null;
    risk_notes: string;
  }>;
  narrative: string;
}

export async function generateAltRouteSuggestion(
  _eventTitle: string,
): Promise<AltRouteSuggestionOutput> {
  await delay(80);
  return {
    alternatives: [
      {
        route_name: 'Cape of Good Hope routing',
        via: 'Cape Town',
        extra_days: 12,
        cost_delta_pct: 18,
        risk_notes: 'Longer transit adds inventory carrying cost; weather risk in southern Atlantic.',
      },
      {
        route_name: 'Trans-Pacific alternative',
        via: 'Singapore → Los Angeles',
        extra_days: 7,
        cost_delta_pct: 12,
        risk_notes: 'Capacity constraints on TPEB lanes; book 4–6 weeks in advance.',
      },
    ],
    narrative: 'Primary route disruption detected. Cape routing adds 12 days but avoids the affected corridor. Trans-Pacific option available for Asia-origin cargo with shorter delay.',
  };
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

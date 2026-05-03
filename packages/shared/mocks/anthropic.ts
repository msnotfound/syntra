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

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export interface AlertContext {
  whyMatters: string;
  recommendedActions: string[];
}

export async function callLLMJson<T>(
  model: string,
  systemPrompt: string,
  userMessage: string,
  fallback?: () => Promise<T>,
): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    if (fallback) return fallback();
    throw new Error('ANTHROPIC_API_KEY not set and no fallback provided');
  }
  const client = getClient();
  const message = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
  const text = (message.content[0] as { type: string; text: string }).text;
  const jsonMatch = text.match(/```json\s*([\s\S]+?)\s*```/) ?? text.match(/(\{[\s\S]+\})/);
  const jsonStr = (jsonMatch?.[1] ?? text).trim();
  return JSON.parse(jsonStr) as T;
}

export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = (vars as Record<string, unknown>)[key];
    if (Array.isArray(val)) return val.join(', ');
    return val !== undefined ? String(val) : '';
  });
}

export interface NLWatchlistParseOutput {
  entity_types: string[];
  countries: string[];
  regions: string[];
  keywords: string[];
  severity_threshold: 'critical' | 'high' | 'medium' | 'low' | null;
  supplier_tiers?: number[];
  summary: string;
  confidence: number;
}

const NL_WATCHLIST_PARSE_MODEL = 'claude-haiku-4-5-20251001';
const NL_WATCHLIST_PARSE_SYSTEM =
  'You parse natural language queries into structured watchlist filter parameters. Return only valid JSON. If you cannot confidently parse a parameter, omit it (do not guess). Set confidence to reflect overall parse confidence.';
const NL_WATCHLIST_PARSE_TEMPLATE = `Available entity types: {{available_entity_types}}
Available regions: {{available_regions}}

User query: "{{user_query}}"

Parse this query into a watchlist filter. Extract: entity_types (from available list), countries (ISO codes), regions (from available list), keywords (for name matching), severity_threshold (null if not specified), supplier_tiers (numbers 1, 2, or 3 when explicitly specified), summary (one sentence translating the query), confidence (0-1). Return JSON.`;

export async function parseNLWatchlistQuery(
  userQuery: string,
  availableEntityTypes: string[],
  availableRegions: string[],
): Promise<NLWatchlistParseOutput> {
  const userMessage = renderTemplate(NL_WATCHLIST_PARSE_TEMPLATE, {
    available_entity_types: availableEntityTypes,
    available_regions: availableRegions,
    user_query: userQuery,
  });

  return callLLMJson<NLWatchlistParseOutput>(
    NL_WATCHLIST_PARSE_MODEL,
    NL_WATCHLIST_PARSE_SYSTEM,
    userMessage,
    async () => {
      const { parseNLWatchlist } = await import('@syntra/shared/mocks/anthropic.js');
      const parsed = await parseNLWatchlist(userQuery, availableEntityTypes, availableRegions);
      const tierMatch = userQuery.match(/\btier\s*([123])\b/i);
      return {
        ...parsed,
        supplier_tiers: tierMatch ? [Number(tierMatch[1])] : [],
      };
    },
  );
}

let _client: import('@anthropic-ai/sdk').default | null = null;

function getClient() {
  if (!_client) {
    const { default: Anthropic } = require('@anthropic-ai/sdk');
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client!;
}

// Cache: (eventId, orgId) → result
const cache = new Map<string, AlertContext>();

export async function generateAlertContext(
  eventTitle: string,
  eventDescription: string,
  affectedEntityNames: string[],
  orgIndustry: string,
  cacheKey: string,
): Promise<AlertContext> {
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    const { generateAlertContext: mockFn } = await import('@syntra/shared/mocks/anthropic.js');
    const result = await mockFn(eventTitle, affectedEntityNames, orgIndustry);
    cache.set(cacheKey, result);
    return result;
  }

  const client = getClient();
  const prompt = `You are a geopolitical risk analyst helping a ${orgIndustry} company assess an alert.

Event: ${eventTitle}
Description: ${eventDescription}
Affected watchlist entities: ${affectedEntityNames.join(', ')}

Provide:
1. ONE sentence explaining why this matters to this company specifically (max 25 words, factual, no hedging)
2. Exactly 3 short recommended actions (each max 15 words, imperative verbs, specific)

Format:
WHY: <one sentence>
ACTIONS:
- <action 1>
- <action 2>
- <action 3>`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (message.content[0] as { type: string; text: string }).text;
  const whyMatch = text.match(/WHY:\s*(.+)/);
  const actionsMatch = [...text.matchAll(/^-\s+(.+)$/gm)];

  const result: AlertContext = {
    whyMatters: whyMatch?.[1]?.trim() ?? 'This event affects your monitored watchlist.',
    recommendedActions: actionsMatch.slice(0, 3).map(m => m[1].trim()),
  };

  cache.set(cacheKey, result);
  return result;
}

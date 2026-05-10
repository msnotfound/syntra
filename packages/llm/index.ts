export interface AlertContext {
  whyMatters: string;
  recommendedActions: string[];
}

export const SUPPLIER_RELATIONSHIP_EXTRACT = {
  id: 'SUPPLIER_RELATIONSHIP_EXTRACT',
  version: '1.0.0',
  model: 'claude-haiku-4-5-20251001',
  system:
    'You extract factual supplier and buyer relationships for supply-chain risk analysis. Return only valid JSON. Do not infer relationships unless the text directly supports them.',
  template: `Event description:
{{event_description}}

Known organization entities:
{{known_entities}}

Extract supplier/buyer relationships stated or strongly evidenced in the description.
Return JSON:
{
  "relationships": [
    {
      "supplier_name": string,
      "buyer_name": string,
      "relationship": "supplies" | "buys_from" | "manufactures_for" | "ships_to",
      "confidence_pct": number,
      "evidence": string
    }
  ]
}

Rules:
- supplier_name is the upstream supplier.
- buyer_name is the downstream buyer/customer.
- Prefer names from Known organization entities when the text clearly refers to them.
- Omit rows below 60 confidence.
- Return an empty relationships array if no supplier/buyer relationship is supported.`,
} as const;

export const CONTRACT_TERMS_EXTRACT = {
  id: 'CONTRACT_TERMS_EXTRACT',
  version: '1.0.0',
  model: 'claude-haiku-4-5-20251001',
  system:
    'You extract operational contract terms for a B2B supply-chain risk platform. Return only strict JSON matching the requested schema. Do not include markdown. Use null when a field is absent. Do not invent parties, dates, values, or clauses.',
  template: `Document URL: {{doc_url}}
Chunk {{chunk_index}} of {{chunk_count}}

Extract structured operational contract data from this text.

Return strict JSON:
{
  "counterparties": [
    { "name": string, "role": "buyer" | "seller" | "guarantor" | "agent", "entity_id": null }
  ],
  "obligations": [
    { "party": string, "description": string, "due_date": string | null, "status": "pending" | "fulfilled" | "breached" | "unknown" }
  ],
  "key_dates": [
    { "label": string, "date": "YYYY-MM-DD", "type": "effective" | "expiry" | "renewal" | "milestone" }
  ],
  "value_clauses": [
    { "description": string, "amount_usd": number | null, "currency": string, "trigger": string | null }
  ],
  "force_majeure": { "covered": boolean, "excerpt": string | null },
  "exclusivity": { "exclusive": boolean, "scope": string | null, "geographies": string[] },
  "confidence_pct": number
}

Rules:
- Use short factual descriptions.
- Include only dates explicitly stated or directly represented by a clause.
- Excerpts must be verbatim snippets under 45 words.
- If a chunk has no relevant data, return empty arrays, covered=false, exclusive=false, confidence_pct=0.

Example 1:
Text: "This Supply Agreement is effective 1 April 2026 between Sundaram Pharma Ltd (Buyer) and Kandla API Manufacturing Pvt Ltd (Seller). Seller shall deliver monthly API batches. Force majeure includes port closure and export restrictions. Buyer commits USD 1,200,000 annually."
JSON:
{"counterparties":[{"name":"Sundaram Pharma Ltd","role":"buyer","entity_id":null},{"name":"Kandla API Manufacturing Pvt Ltd","role":"seller","entity_id":null}],"obligations":[{"party":"Kandla API Manufacturing Pvt Ltd","description":"Deliver monthly API batches.","due_date":null,"status":"pending"}],"key_dates":[{"label":"Effective Date","date":"2026-04-01","type":"effective"}],"value_clauses":[{"description":"Annual buyer commitment.","amount_usd":1200000,"currency":"USD","trigger":"annual commitment"}],"force_majeure":{"covered":true,"excerpt":"Force majeure includes port closure and export restrictions."},"exclusivity":{"exclusive":false,"scope":null,"geographies":[]},"confidence_pct":92}

Example 2:
Text: "Distributor has exclusive rights in Kenya and Tanzania until 31 December 2027. Renewal notice must be sent by 30 September 2027."
JSON:
{"counterparties":[],"obligations":[{"party":"Distributor","description":"Send renewal notice by the stated notice deadline.","due_date":"2027-09-30","status":"pending"}],"key_dates":[{"label":"Expiry Date","date":"2027-12-31","type":"expiry"},{"label":"Renewal Notice Deadline","date":"2027-09-30","type":"renewal"}],"value_clauses":[],"force_majeure":{"covered":false,"excerpt":null},"exclusivity":{"exclusive":true,"scope":"Distributor exclusive rights.","geographies":["Kenya","Tanzania"]},"confidence_pct":86}

Contract text:
{{text}}`,
} as const;

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

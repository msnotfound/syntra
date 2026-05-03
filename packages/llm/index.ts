export interface AlertContext {
  whyMatters: string;
  recommendedActions: string[];
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
    const { generateAlertContext: mockFn } = await import('@syntra/shared/mocks/anthropic');
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

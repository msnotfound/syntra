import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { WatchlistEntity, Organization } from '@syntra/db';
import { callLLMJson, renderTemplate } from '@syntra/llm';
import { ensureDb } from '@/lib/db';
import { deriveActions } from '@/lib/watchlist/nl-actions';
import type { NLWatchlistParsed } from '@/lib/watchlist/nl-actions';

// Inline the prompt definition from contracts/05-llm-prompts.contract.ts
// (import via relative path would require resolving outside Next.js bundler scope)
const NL_WATCHLIST_PARSE_MODEL = 'claude-haiku-4-5-20251001';
const NL_WATCHLIST_PARSE_SYSTEM =
  'You parse natural language queries into structured watchlist filter parameters. Return only valid JSON. If you cannot confidently parse a parameter, omit it (do not guess). Set confidence to reflect overall parse confidence.';
const NL_WATCHLIST_PARSE_TEMPLATE = `Available entity types: {{available_entity_types}}
Available regions: {{available_regions}}

User query: "{{user_query}}"

Parse this query into a watchlist filter. Extract: entity_types (from available list), countries (ISO codes), regions (from available list), keywords (for name matching), severity_threshold (null if not specified), summary (one sentence translating the query), confidence (0–1). Return JSON.`;

const RequestSchema = z.object({
  prompt: z.string().min(1).max(500),
  orgSlug: z.string().min(1),
  confirm: z.boolean().optional(),
  removeIds: z.array(z.string()).optional(),
});

const AVAILABLE_ENTITY_TYPES = ['supplier', 'port', 'route', 'country', 'region', 'asset'];
const AVAILABLE_REGIONS = ['south_asia', 'southeast_asia', 'middle_east', 'east_africa', 'europe', 'north_america', 'east_asia'];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Invalid input' }, { status: 400 });
  }

  const { prompt, orgSlug, confirm, removeIds } = parsed.data;

  await ensureDb();
  const org = await Organization.findOne({ slug: orgSlug }).lean();
  if (!org) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Organization not found' }, { status: 404 });
  }

  // Confirm mode: execute pending REMOVE actions
  if (confirm && removeIds?.length) {
    await WatchlistEntity.updateMany(
      { _id: { $in: removeIds }, org_id: org._id },
      { active: false },
    );
    return NextResponse.json({ data: { confirmed: true, removed: removeIds.length } });
  }

  // Parse phase: call LLM to get structured filter
  const currentEntities = await WatchlistEntity.find({ org_id: org._id, active: true })
    .select('type name country_code region')
    .lean();

  const userMessage = renderTemplate(NL_WATCHLIST_PARSE_TEMPLATE, {
    available_entity_types: AVAILABLE_ENTITY_TYPES,
    available_regions: AVAILABLE_REGIONS,
    user_query: prompt,
  });

  let nlParsed: NLWatchlistParsed;
  try {
    nlParsed = await callLLMJson<NLWatchlistParsed>(
      NL_WATCHLIST_PARSE_MODEL,
      NL_WATCHLIST_PARSE_SYSTEM,
      userMessage,
      async () => {
        const { parseNLWatchlist } = await import('@syntra/shared/mocks/anthropic.js');
        return parseNLWatchlist(prompt, AVAILABLE_ENTITY_TYPES, AVAILABLE_REGIONS);
      },
    );
  } catch {
    return NextResponse.json({ error: 'LLM_ERROR', message: 'Failed to parse query' }, { status: 502 });
  }

  const actions = deriveActions(prompt, nlParsed, currentEntities as Parameters<typeof deriveActions>[2]);

  return NextResponse.json({
    data: {
      parsed: nlParsed,
      actions,
      promptId: 'NL_WATCHLIST_PARSE',
      promptVersion: '1.0.0',
    },
  });
}

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { NLConversation, Organization, WatchlistEntity } from '@syntra/db';
import { parseNLWatchlistQuery } from '@syntra/llm';
import { getServerAuth } from '@/lib/auth';
import { ensureDb } from '@/lib/db';
import {
  deriveConversationalPlan,
  splitActionSegments,
  type MatchableEntity,
  type NLConversationTurn,
  type NLWatchlistParsed,
} from '@/lib/watchlist/nl-actions';

const TurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().min(1).max(1000),
  entity_ids: z.array(z.string()).optional().default([]),
});

const RequestSchema = z.object({
  query: z.string().min(1).max(500).optional(),
  prompt: z.string().min(1).max(500).optional(),
  orgSlug: z.string().min(1).optional(),
  conversation_id: z.string().min(1).max(120).optional(),
  turns: z.array(TurnSchema).max(10).optional().default([]),
  confirm: z.boolean().optional(),
  removeIds: z.array(z.string()).optional(),
}).refine(body => !!(body.query ?? body.prompt), {
  message: 'query is required',
  path: ['query'],
});

const AVAILABLE_ENTITY_TYPES = ['supplier', 'port', 'route', 'country', 'region', 'asset'];
const AVAILABLE_REGIONS = ['south_asia', 'southeast_asia', 'middle_east', 'east_africa', 'europe', 'north_america', 'east_asia'];
const MAX_TURNS = 10;

function serializeTurn(turn: {
  role: 'user' | 'assistant';
  text: string;
  entity_ids?: string[];
}): NLConversationTurn {
  return {
    role: turn.role,
    text: turn.text,
    entity_ids: turn.entity_ids ?? [],
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

async function parseSegments(query: string): Promise<NLWatchlistParsed[]> {
  const segments = splitActionSegments(query);
  const parsed = await Promise.all(
    segments.map(segment => parseNLWatchlistQuery(
      segment.text,
      AVAILABLE_ENTITY_TYPES,
      AVAILABLE_REGIONS,
    )),
  );
  return parsed.map(item => ({
    entity_types: item.entity_types ?? [],
    countries: item.countries ?? [],
    regions: item.regions ?? [],
    keywords: item.keywords ?? [],
    severity_threshold: item.severity_threshold ?? null,
    supplier_tiers: item.supplier_tiers ?? [],
    summary: item.summary,
    confidence: item.confidence,
  }));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Invalid input' }, { status: 400 });
  }

  const session = await getServerAuth();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Not authenticated' }, { status: 401 });
  }

  const query = (parsed.data.query ?? parsed.data.prompt ?? '').trim();
  const orgSlug = parsed.data.orgSlug ?? session.orgSlug;
  const conversationId = parsed.data.conversation_id ?? randomUUID();

  await ensureDb();
  const org = await Organization.findOne({ slug: orgSlug }).lean();
  if (!org) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Organization not found' }, { status: 404 });
  }

  if (parsed.data.confirm && parsed.data.removeIds?.length) {
    await WatchlistEntity.updateMany(
      { _id: { $in: parsed.data.removeIds }, org_id: org._id },
      { active: false },
    );
    return NextResponse.json({
      data: {
        confirmed: true,
        removed: parsed.data.removeIds.length,
        conversation_id: conversationId,
      },
    });
  }

  const [conversation, currentEntities] = await Promise.all([
    NLConversation.findOne({
      org_id: org._id,
      user_id: session.userId,
      conversation_id: conversationId,
    }).lean(),
    WatchlistEntity.find({ org_id: org._id, active: true })
      .select('type name country_code region supplier_tier')
      .lean(),
  ]);

  const previousTurns = [
    ...((conversation?.turns ?? []).map(serializeTurn)),
    ...parsed.data.turns.map(serializeTurn),
  ].slice(-MAX_TURNS);

  let parsedSegments: NLWatchlistParsed[];
  try {
    parsedSegments = await parseSegments(query);
  } catch {
    return NextResponse.json({ error: 'LLM_ERROR', message: 'Failed to parse query' }, { status: 502 });
  }

  const plan = deriveConversationalPlan(
    query,
    parsedSegments,
    currentEntities as unknown as MatchableEntity[],
    previousTurns,
  );

  const entityIds = unique(plan.actions.flatMap(action => action.entity_ids));
  const assistantText = plan.status === 'clarification'
    ? plan.clarification?.question ?? 'Clarification needed.'
    : plan.actions.map(action => action.summary).join(' ');
  const storedTurns = [
    ...previousTurns,
    { role: 'user' as const, text: query, entity_ids: [] },
    { role: 'assistant' as const, text: assistantText, entity_ids: entityIds },
  ].slice(-MAX_TURNS);

  await NLConversation.updateOne(
    { org_id: org._id, user_id: session.userId, conversation_id: conversationId },
    { $set: { turns: storedTurns } },
    { upsert: true },
  );

  return NextResponse.json({
    data: {
      status: plan.status,
      conversation_id: conversationId,
      turns: storedTurns,
      parsed: parsedSegments[0],
      parsed_segments: parsedSegments,
      actions: plan.legacy_actions,
      plan: plan.actions,
      clarification: plan.clarification,
      promptId: 'NL_WATCHLIST_PARSE',
      promptVersion: '1.0.0',
    },
  });
}

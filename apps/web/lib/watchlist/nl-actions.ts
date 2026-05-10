export interface NLWatchlistParsed {
  entity_types: string[];
  countries: string[];
  regions: string[];
  keywords: string[];
  severity_threshold: 'critical' | 'high' | 'medium' | 'low' | null;
  supplier_tiers?: number[];
  summary: string;
  confidence: number;
}

export interface EntityRef {
  id: string;
  name: string;
  type: string;
}

export interface UpdateAction {
  field: string;
  from: string;
  to: string;
}

export interface NLActions {
  add: string[];
  remove: EntityRef[];
  update: UpdateAction[];
}

export interface MatchableEntity {
  _id: unknown;
  name: string;
  type: string;
  country_code: string | null;
  region: string | null;
  supplier_tier?: number | null;
}

export type NLIntent = 'add' | 'remove' | 'update' | 'filter';

export interface NLActionSegment {
  intent: NLIntent;
  text: string;
}

export interface NLConversationTurn {
  role: 'user' | 'assistant';
  text: string;
  entity_ids?: string[];
}

export interface NLPlanAction {
  intent: NLIntent;
  text: string;
  summary: string;
  criteria: NLWatchlistParsed;
  entity_ids: string[];
  entities: EntityRef[];
  updates: UpdateAction[];
}

export interface NLClarification {
  question: string;
  options: string[];
}

export interface NLConversationalPlan {
  status: 'ready' | 'clarification';
  actions: NLPlanAction[];
  clarification: NLClarification | null;
  legacy_actions: NLActions;
}

const REMOVE_INTENT = /\b(remove|delete|stop tracking|clear|drop|unwatch|stop watching)\b/i;
const ADD_INTENT = /\b(add|track|watch|monitor|alert me about)\b/i;
const UPDATE_INTENT = /\b(make|set|change|update|critical-only|high-only|medium-only|low-only)\b/i;
const FILTER_INTENT = /\b(only|tier\s*[123]|critical-only|high-only|medium-only|low-only)\b/i;
const FOLLOW_UP_REF = /\b(those|them|that|these|same ones|previous)\b/i;

export function matchesFilter(entity: MatchableEntity, filter: NLWatchlistParsed): boolean {
  if (filter.entity_types.length > 0 && !filter.entity_types.includes(entity.type)) return false;
  if (filter.countries.length > 0 && !(entity.country_code && filter.countries.includes(entity.country_code))) return false;
  if (filter.regions.length > 0 && !(entity.region && filter.regions.includes(entity.region))) return false;
  if ((filter.supplier_tiers?.length ?? 0) > 0 && !(entity.supplier_tier && filter.supplier_tiers?.includes(entity.supplier_tier))) return false;
  if (filter.keywords.length > 0 && !filter.keywords.some(k =>
    entity.name.toLowerCase().includes(k.toLowerCase())
  )) return false;
  return true;
}

function inferIntent(text: string, fallback: NLIntent = 'add'): NLIntent {
  if (REMOVE_INTENT.test(text)) return 'remove';
  if (UPDATE_INTENT.test(text) && !ADD_INTENT.test(text)) return 'update';
  if (FILTER_INTENT.test(text) && !ADD_INTENT.test(text)) return 'filter';
  if (ADD_INTENT.test(text)) return 'add';
  return fallback;
}

function normalizeSegment(text: string): string {
  return text.trim().replace(/\s+/g, ' ').replace(/^[,;]\s*/, '').replace(/\s*[,;]$/, '');
}

export function splitActionSegments(prompt: string): NLActionSegment[] {
  const parts = prompt
    .split(/\s+\bbut\b\s+/i)
    .map(normalizeSegment)
    .filter(Boolean);
  const segments: NLActionSegment[] = [];

  parts.forEach((part, partIndex) => {
    const commaParts = part.split(/\s*,\s*/).map(normalizeSegment).filter(Boolean);
    commaParts.forEach((commaPart) => {
      const intent = partIndex > 0 && !ADD_INTENT.test(commaPart) && !REMOVE_INTENT.test(commaPart)
        ? 'filter'
        : inferIntent(commaPart, segments.at(-1)?.intent ?? 'add');

      const andParts = commaPart.split(/\s+\band\b\s+/i).map(normalizeSegment).filter(Boolean);
      if (andParts.length > 1 && (intent === 'add' || intent === 'remove')) {
        andParts.forEach((andPart, index) => {
          segments.push({
            intent: index === 0 ? intent : inferIntent(andPart, intent),
            text: index === 0 ? andPart : andPart.replace(/^(add|track|watch|monitor|remove|delete)\s+/i, ''),
          });
        });
        return;
      }

      segments.push({ intent, text: commaPart });
    });
  });

  return segments.length > 0 ? segments : [{ intent: inferIntent(prompt), text: normalizeSegment(prompt) }];
}

function toEntityRef(entity: MatchableEntity): EntityRef {
  return { id: String(entity._id), name: entity.name, type: entity.type };
}

function lastEntityIds(turns: NLConversationTurn[]): string[] {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const ids = turns[i].entity_ids;
    if (ids && ids.length > 0) return ids;
  }
  return [];
}

function matchingEntities(parsed: NLWatchlistParsed, currentEntities: MatchableEntity[]): MatchableEntity[] {
  return currentEntities.filter(entity => matchesFilter(entity, parsed));
}

function clarificationForAmbiguity(
  prompt: string,
  parsed: NLWatchlistParsed,
  currentEntities: MatchableEntity[],
): NLClarification | null {
  if (parsed.entity_types.length > 0 || parsed.keywords.length === 0) return null;

  const matches = matchingEntities(parsed, currentEntities);
  const matchedTypes = new Set(matches.map(entity => entity.type));
  if (matches.length < 2 && matchedTypes.size < 2) return null;

  const keyword = parsed.keywords.find(k => prompt.toLowerCase().includes(k.toLowerCase())) ?? parsed.keywords[0];
  return {
    question: `Did you mean ${keyword} as a specific entity or location?`,
    options: matches.slice(0, 5).map(entity => entity.name),
  };
}

function updatesFor(parsed: NLWatchlistParsed): UpdateAction[] {
  return parsed.severity_threshold
    ? [{ field: 'severity_threshold', from: 'current', to: parsed.severity_threshold }]
    : [];
}

function emptyActions(): NLActions {
  return { add: [], remove: [], update: [] };
}

export function deriveConversationalPlan(
  prompt: string,
  parsedSegments: NLWatchlistParsed[],
  currentEntities: MatchableEntity[],
  previousTurns: NLConversationTurn[] = [],
): NLConversationalPlan {
  const lowConfidence = parsedSegments.find(parsed => parsed.confidence < 0.7);
  if (lowConfidence) {
    return {
      status: 'clarification',
      actions: [],
      clarification: {
        question: 'Can you clarify what you want to watch or change?',
        options: [],
      },
      legacy_actions: emptyActions(),
    };
  }

  const segments = splitActionSegments(prompt);
  for (let i = 0; i < parsedSegments.length; i += 1) {
    const clarification = clarificationForAmbiguity(segments[i]?.text ?? prompt, parsedSegments[i], currentEntities);
    if (clarification) {
      return {
        status: 'clarification',
        actions: [],
        clarification,
        legacy_actions: emptyActions(),
      };
    }
  }

  const previousEntityIds = lastEntityIds(previousTurns);
  const actions = parsedSegments.map((parsed, index): NLPlanAction => {
    const segment = segments[index] ?? segments[segments.length - 1] ?? { intent: inferIntent(prompt), text: prompt };
    const updates = updatesFor(parsed);
    const intent: NLIntent = updates.length > 0 && FOLLOW_UP_REF.test(prompt) ? 'update' : segment.intent;
    const matched = matchingEntities(parsed, currentEntities);
    const entityIds = matched.length > 0
      ? matched.map(entity => String(entity._id))
      : (FOLLOW_UP_REF.test(prompt) ? previousEntityIds : []);

    return {
      intent,
      text: segment.text,
      summary: parsed.summary,
      criteria: parsed,
      entity_ids: entityIds,
      entities: matched.map(toEntityRef),
      updates,
    };
  });

  const legacy = actions.reduce<NLActions>((acc, action) => {
    if (action.intent === 'add') {
      acc.add.push(action.summary);
    }
    if (action.intent === 'remove') {
      acc.remove.push(...action.entities);
    }
    acc.update.push(...action.updates);
    return acc;
  }, emptyActions());

  return {
    status: 'ready',
    actions,
    clarification: null,
    legacy_actions: legacy,
  };
}

export function deriveActions(
  prompt: string,
  parsed: NLWatchlistParsed,
  currentEntities: MatchableEntity[],
): NLActions {
  const update: UpdateAction[] = parsed.severity_threshold
    ? [{ field: 'severity_threshold', from: 'current', to: parsed.severity_threshold }]
    : [];

  if (REMOVE_INTENT.test(prompt)) {
    const toRemove = currentEntities.filter(e => matchesFilter(e, parsed));
    return {
      add: [],
      remove: toRemove.map(e => ({ id: String(e._id), name: e.name, type: e.type })),
      update,
    };
  }

  const typeLabel = parsed.entity_types.length ? parsed.entity_types.join('/') : 'entities';
  const addDescriptions: string[] = [];

  if (parsed.countries.length > 0) {
    addDescriptions.push(`${typeLabel} in ${parsed.countries.join(', ')}`);
  } else if (parsed.regions.length > 0) {
    addDescriptions.push(`${typeLabel} in ${parsed.regions.join(', ')}`);
  } else if (parsed.keywords.length > 0) {
    addDescriptions.push(`${typeLabel} matching: ${parsed.keywords.join(', ')}`);
  } else {
    addDescriptions.push(parsed.summary);
  }

  return { add: addDescriptions, remove: [], update };
}

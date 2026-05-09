export interface NLWatchlistParsed {
  entity_types: string[];
  countries: string[];
  regions: string[];
  keywords: string[];
  severity_threshold: 'critical' | 'high' | 'medium' | 'low' | null;
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

interface MatchableEntity {
  _id: unknown;
  name: string;
  type: string;
  country_code: string | null;
  region: string | null;
}

const REMOVE_INTENT = /\b(remove|delete|stop tracking|clear|drop|unwatch|stop watching)\b/i;

export function matchesFilter(entity: MatchableEntity, filter: NLWatchlistParsed): boolean {
  if (filter.entity_types.length > 0 && !filter.entity_types.includes(entity.type)) return false;
  if (filter.countries.length > 0 && !(entity.country_code && filter.countries.includes(entity.country_code))) return false;
  if (filter.regions.length > 0 && !(entity.region && filter.regions.includes(entity.region))) return false;
  if (filter.keywords.length > 0 && !filter.keywords.some(k =>
    entity.name.toLowerCase().includes(k.toLowerCase())
  )) return false;
  return true;
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

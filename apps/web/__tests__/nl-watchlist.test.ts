import { deriveActions, matchesFilter } from '../lib/watchlist/nl-actions';
import type { NLWatchlistParsed } from '../lib/watchlist/nl-actions';

const FIXTURE_PARSE_OUTPUT: NLWatchlistParsed = {
  entity_types: ['supplier'],
  countries: ['IN'],
  regions: [],
  keywords: ['pharma'],
  severity_threshold: null,
  summary: 'Track pharma suppliers in India',
  confidence: 0.9,
};

const FIXTURE_ENTITIES = [
  { _id: 'id1', name: 'Sundaram Pharma', type: 'supplier', country_code: 'IN', region: null },
  { _id: 'id2', name: 'Mumbai Port', type: 'port', country_code: 'IN', region: null },
  { _id: 'id3', name: 'Chennai Supplier', type: 'supplier', country_code: 'IN', region: null },
  { _id: 'id4', name: 'Singapore Hub', type: 'port', country_code: 'SG', region: null },
];

describe('deriveActions — ADD intent', () => {
  test('returns add descriptions, no removes', () => {
    const actions = deriveActions('Track pharma suppliers in India', FIXTURE_PARSE_OUTPUT, []);
    expect(actions.add).toHaveLength(1);
    expect(actions.add[0]).toContain('supplier');
    expect(actions.add[0]).toContain('IN');
    expect(actions.remove).toHaveLength(0);
    expect(actions.update).toHaveLength(0);
  });

  test('add description includes entity type and country', () => {
    const actions = deriveActions('Watch ports in SG', {
      ...FIXTURE_PARSE_OUTPUT,
      entity_types: ['port'],
      countries: ['SG'],
    }, []);
    expect(actions.add[0]).toMatch(/port/i);
    expect(actions.add[0]).toContain('SG');
  });

  test('uses region when no countries specified', () => {
    const actions = deriveActions('Monitor suppliers in Southeast Asia', {
      ...FIXTURE_PARSE_OUTPUT,
      countries: [],
      regions: ['southeast_asia'],
    }, []);
    expect(actions.add[0]).toContain('southeast_asia');
  });

  test('falls back to summary when no geo criteria', () => {
    const actions = deriveActions('Watch high-risk entities', {
      ...FIXTURE_PARSE_OUTPUT,
      countries: [],
      regions: [],
      keywords: [],
    }, FIXTURE_ENTITIES);
    expect(actions.add[0]).toBe(FIXTURE_PARSE_OUTPUT.summary);
  });
});

describe('deriveActions — REMOVE intent', () => {
  test('"remove" keyword triggers remove intent', () => {
    const actions = deriveActions('Remove all suppliers in India', FIXTURE_PARSE_OUTPUT, FIXTURE_ENTITIES);
    expect(actions.add).toHaveLength(0);
    expect(actions.remove.length).toBeGreaterThan(0);
  });

  test('removes only entities matching the filter', () => {
    const actions = deriveActions('Remove all suppliers in India', FIXTURE_PARSE_OUTPUT, FIXTURE_ENTITIES);
    // Only type=supplier AND country_code=IN entities should appear
    // FIXTURE: id1 (supplier/IN), id3 (supplier/IN) match; id2 (port/IN), id4 (port/SG) do not
    expect(actions.remove).toHaveLength(2);
    expect(actions.remove.map(e => e.id)).toContain('id1');
    expect(actions.remove.map(e => e.id)).toContain('id3');
  });

  test('"stop tracking" triggers remove intent', () => {
    const actions = deriveActions('Stop tracking ports in Singapore', {
      ...FIXTURE_PARSE_OUTPUT,
      entity_types: ['port'],
      countries: ['SG'],
    }, FIXTURE_ENTITIES);
    expect(actions.remove).toHaveLength(1);
    expect(actions.remove[0].id).toBe('id4');
  });

  test('remove with no matching entities returns empty remove list', () => {
    const actions = deriveActions('Delete routes in US', {
      ...FIXTURE_PARSE_OUTPUT,
      entity_types: ['route'],
      countries: ['US'],
    }, FIXTURE_ENTITIES);
    expect(actions.remove).toHaveLength(0);
  });
});

describe('deriveActions — UPDATE intent', () => {
  test('severity_threshold generates update action', () => {
    const actions = deriveActions('Only alert me for critical risks', {
      ...FIXTURE_PARSE_OUTPUT,
      severity_threshold: 'critical',
    }, []);
    expect(actions.update).toHaveLength(1);
    expect(actions.update[0].field).toBe('severity_threshold');
    expect(actions.update[0].to).toBe('critical');
  });

  test('null severity_threshold generates no update', () => {
    const actions = deriveActions('Track suppliers in India', FIXTURE_PARSE_OUTPUT, []);
    expect(actions.update).toHaveLength(0);
  });
});

describe('matchesFilter', () => {
  test('entity matching type and country returns true', () => {
    const entity = { _id: 'x', name: 'Test', type: 'supplier', country_code: 'IN', region: null };
    expect(matchesFilter(entity, FIXTURE_PARSE_OUTPUT)).toBe(true);
  });

  test('wrong entity type returns false', () => {
    const entity = { _id: 'x', name: 'Test', type: 'port', country_code: 'IN', region: null };
    expect(matchesFilter(entity, FIXTURE_PARSE_OUTPUT)).toBe(false);
  });

  test('wrong country code returns false', () => {
    const entity = { _id: 'x', name: 'Test', type: 'supplier', country_code: 'SG', region: null };
    expect(matchesFilter(entity, FIXTURE_PARSE_OUTPUT)).toBe(false);
  });

  test('entity with no country_code fails country filter', () => {
    const entity = { _id: 'x', name: 'Test', type: 'supplier', country_code: null, region: null };
    expect(matchesFilter(entity, FIXTURE_PARSE_OUTPUT)).toBe(false);
  });

  test('empty filter matches any entity', () => {
    const emptyFilter: NLWatchlistParsed = {
      entity_types: [],
      countries: [],
      regions: [],
      keywords: [],
      severity_threshold: null,
      summary: '',
      confidence: 1,
    };
    const entity = { _id: 'x', name: 'Anything', type: 'asset', country_code: 'US', region: null };
    expect(matchesFilter(entity, emptyFilter)).toBe(true);
  });

  test('keyword filter matches entity name case-insensitively', () => {
    const filter: NLWatchlistParsed = {
      entity_types: [],
      countries: [],
      regions: [],
      keywords: ['PHARMA'],
      severity_threshold: null,
      summary: '',
      confidence: 1,
    };
    const entity = { _id: 'x', name: 'Sundaram Pharma Ltd', type: 'supplier', country_code: 'IN', region: null };
    expect(matchesFilter(entity, filter)).toBe(true);
  });

  test('mock parseNLWatchlist returns deterministic stub', async () => {
    const { parseNLWatchlist } = await import('../../packages/shared/mocks/anthropic');
    const result = await parseNLWatchlist('Track suppliers in India', ['supplier', 'port'], ['south_asia']);
    expect(result.entity_types).toContain('supplier');
    expect(result.countries).toContain('IN');
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThan(0);
  });
});

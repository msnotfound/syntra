import {
  deriveActions,
  deriveConversationalPlan,
  matchesFilter,
  splitActionSegments,
} from '../lib/watchlist/nl-actions';
import type { NLConversationTurn, NLWatchlistParsed } from '../lib/watchlist/nl-actions';

const FIXTURE_PARSE_OUTPUT: NLWatchlistParsed = {
  entity_types: ['supplier'],
  countries: ['IN'],
  regions: [],
  keywords: [],
  severity_threshold: null,
  summary: 'Track pharma suppliers in India',
  confidence: 0.9,
};

const FIXTURE_ENTITIES = [
  { _id: 'id1', name: 'Sundaram Pharma', type: 'supplier', country_code: 'IN', region: null },
  { _id: 'id2', name: 'Mumbai Port', type: 'port', country_code: 'IN', region: null },
  { _id: 'id3', name: 'Chennai Supplier', type: 'supplier', country_code: 'IN', region: null },
  { _id: 'id4', name: 'Singapore Hub', type: 'port', country_code: 'SG', region: null },
  { _id: 'id5', name: 'Mumbai API Supplier', type: 'supplier', country_code: 'IN', region: null, supplier_tier: 1 },
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
    // Only type=supplier AND country_code=IN entities should appear.
    expect(actions.remove).toHaveLength(3);
    expect(actions.remove.map(e => e.id)).toContain('id1');
    expect(actions.remove.map(e => e.id)).toContain('id3');
    expect(actions.remove.map(e => e.id)).toContain('id5');
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
    const { parseNLWatchlist } = await import('@syntra/shared/mocks/anthropic.js');
    const result = await parseNLWatchlist('Track suppliers in India', ['supplier', 'port'], ['south_asia']);
    expect(result.entity_types).toContain('supplier');
    expect(result.countries).toContain('IN');
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThan(0);
  });
});

describe('splitActionSegments', () => {
  test('splits conjunctions into ordered intents', () => {
    const segments = splitActionSegments('add pharma suppliers and ports in India, remove Singapore Hub');

    expect(segments).toEqual([
      { intent: 'add', text: 'add pharma suppliers' },
      { intent: 'add', text: 'ports in India' },
      { intent: 'remove', text: 'remove Singapore Hub' },
    ]);
  });

  test('treats BUT clauses as filter refinements', () => {
    const segments = splitActionSegments('add suppliers in Mumbai BUT only Tier 1');

    expect(segments).toEqual([
      { intent: 'add', text: 'add suppliers in Mumbai' },
      { intent: 'filter', text: 'only Tier 1' },
    ]);
  });
});

describe('deriveConversationalPlan', () => {
  test('turns add-plus-filter conjunctions into a two-step plan', () => {
    const parsed: NLWatchlistParsed[] = [
      {
        entity_types: ['supplier'],
        countries: [],
        regions: [],
        keywords: ['Mumbai'],
        severity_threshold: null,
        summary: 'Add suppliers matching Mumbai',
        confidence: 0.9,
      },
      {
        entity_types: [],
        countries: [],
        regions: [],
        keywords: [],
        severity_threshold: null,
        supplier_tiers: [1],
        summary: 'Only Tier 1 suppliers',
        confidence: 0.92,
      },
    ];

    const plan = deriveConversationalPlan(
      'add suppliers in Mumbai BUT only Tier 1',
      parsed,
      FIXTURE_ENTITIES,
      [],
    );

    expect(plan.status).toBe('ready');
    expect(plan.actions).toHaveLength(2);
    expect(plan.actions.map(action => action.intent)).toEqual(['add', 'filter']);
    expect(plan.actions[0].entity_ids).toEqual(['id5']);
    expect(plan.actions[1].criteria.supplier_tiers).toEqual([1]);
  });

  test('returns clarification when parse confidence is below 70 percent', () => {
    const plan = deriveConversationalPlan(
      'track the usual risky ones',
      [{ ...FIXTURE_PARSE_OUTPUT, confidence: 0.62 }],
      FIXTURE_ENTITIES,
      [],
    );

    expect(plan.status).toBe('clarification');
    expect(plan.clarification?.question).toMatch(/clarify/i);
    expect(plan.actions).toHaveLength(0);
  });

  test('returns clarification when a location has multiple matching interpretations', () => {
    const plan = deriveConversationalPlan(
      'add Mumbai',
      [{
        entity_types: [],
        countries: [],
        regions: [],
        keywords: ['Mumbai'],
        severity_threshold: null,
        summary: 'Add Mumbai',
        confidence: 0.91,
      }],
      FIXTURE_ENTITIES,
      [],
    );

    expect(plan.status).toBe('clarification');
    expect(plan.clarification?.question).toContain('Mumbai');
    expect(plan.clarification?.options).toContain('Mumbai Port');
    expect(plan.clarification?.options).toContain('Mumbai API Supplier');
  });

  test('follow-up updates reuse entity ids from the previous turn', () => {
    const previousTurns: NLConversationTurn[] = [{
      role: 'assistant',
      text: 'Added Mumbai suppliers',
      entity_ids: ['id5'],
    }];

    const plan = deriveConversationalPlan(
      'now make those critical-only',
      [{
        entity_types: [],
        countries: [],
        regions: [],
        keywords: [],
        severity_threshold: 'critical',
        summary: 'Make those critical only',
        confidence: 0.88,
      }],
      FIXTURE_ENTITIES,
      previousTurns,
    );

    expect(plan.status).toBe('ready');
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({
      intent: 'update',
      entity_ids: ['id5'],
      updates: [{ field: 'severity_threshold', from: 'current', to: 'critical' }],
    });
  });

  test('multi-action prompts return one ordered plan item per action', () => {
    const plan = deriveConversationalPlan(
      'add pharma suppliers and ports in India, remove Singapore Hub',
      [
        { ...FIXTURE_PARSE_OUTPUT, summary: 'Add pharma suppliers in India' },
        {
          ...FIXTURE_PARSE_OUTPUT,
          entity_types: ['port'],
          keywords: [],
          summary: 'Add ports in India',
        },
        {
          ...FIXTURE_PARSE_OUTPUT,
          entity_types: ['port'],
          countries: ['SG'],
          keywords: ['Singapore Hub'],
          summary: 'Remove Singapore Hub',
        },
      ],
      FIXTURE_ENTITIES,
      [],
    );

    expect(plan.status).toBe('ready');
    expect(plan.actions.map(action => action.intent)).toEqual(['add', 'add', 'remove']);
    expect(plan.actions).toHaveLength(3);
    expect(plan.actions[2].entity_ids).toEqual(['id4']);
  });

  test('follow-up "show me also" extends the previous active filter', () => {
    const previousState = {
      active_filter: FIXTURE_PARSE_OUTPUT,
      excluded_filters: [],
      entity_ids: ['id1', 'id3'],
      filter_history: [],
    };

    const plan = deriveConversationalPlan(
      'show me also ports in Singapore',
      [{
        entity_types: ['port'],
        countries: ['SG'],
        regions: [],
        keywords: [],
        severity_threshold: null,
        summary: 'Also include ports in Singapore',
        confidence: 0.9,
      }],
      FIXTURE_ENTITIES,
      [],
      previousState,
    );

    expect(plan.status).toBe('ready');
    expect(plan.actions[0].entity_ids).toEqual(['id1', 'id3', 'id4']);
    expect(plan.state.entity_ids).toEqual(['id1', 'id3', 'id4']);
  });

  test('follow-up "just" narrows the previous active filter', () => {
    const previousState = {
      active_filter: {
        ...FIXTURE_PARSE_OUTPUT,
        keywords: ['Mumbai'],
      },
      excluded_filters: [],
      entity_ids: ['id5'],
      filter_history: [],
    };

    const plan = deriveConversationalPlan(
      'just the tier 1 ones',
      [{
        entity_types: [],
        countries: [],
        regions: [],
        keywords: [],
        severity_threshold: null,
        supplier_tiers: [1],
        summary: 'Only tier 1',
        confidence: 0.9,
      }],
      FIXTURE_ENTITIES,
      [],
      previousState,
    );

    expect(plan.status).toBe('ready');
    expect(plan.actions[0].intent).toBe('filter');
    expect(plan.actions[0].entity_ids).toEqual(['id5']);
    expect(plan.state.filter_history).toHaveLength(1);
  });

  test('remove that restores the previous filter state', () => {
    const plan = deriveConversationalPlan(
      'remove that',
      [{
        entity_types: [],
        countries: [],
        regions: [],
        keywords: [],
        severity_threshold: null,
        summary: 'Remove the last filter',
        confidence: 0.9,
      }],
      FIXTURE_ENTITIES,
      [],
      {
        active_filter: {
          ...FIXTURE_PARSE_OUTPUT,
          supplier_tiers: [1],
        },
        excluded_filters: [],
        entity_ids: ['id5'],
        filter_history: [{
          active_filter: FIXTURE_PARSE_OUTPUT,
          excluded_filters: [],
          entity_ids: ['id1', 'id3'],
        }],
      },
    );

    expect(plan.status).toBe('ready');
    expect(plan.actions[0].intent).toBe('filter');
    expect(plan.actions[0].entity_ids).toEqual(['id1', 'id3']);
    expect(plan.state.entity_ids).toEqual(['id1', 'id3']);
    expect(plan.state.filter_history).toHaveLength(0);
  });

  test('remove that falls back to previous turn ids instead of matching everything', () => {
    const plan = deriveConversationalPlan(
      'remove that',
      [{
        entity_types: [],
        countries: [],
        regions: [],
        keywords: [],
        severity_threshold: null,
        summary: 'Remove the last filter',
        confidence: 0.9,
      }],
      FIXTURE_ENTITIES,
      [{ role: 'assistant', text: 'Showing suppliers in India', entity_ids: ['id1', 'id3'] }],
    );

    expect(plan.status).toBe('ready');
    expect(plan.actions[0].intent).toBe('filter');
    expect(plan.actions[0].entity_ids).toEqual(['id1', 'id3']);
    expect(plan.state.entity_ids).toEqual(['id1', 'id3']);
  });

  test('but not excludes matching entities from the active filter', () => {
    const plan = deriveConversationalPlan(
      'add suppliers in India but not tier 1',
      [
        FIXTURE_PARSE_OUTPUT,
        {
          entity_types: [],
          countries: [],
          regions: [],
          keywords: [],
          severity_threshold: null,
          supplier_tiers: [1],
          summary: 'Exclude tier 1',
          confidence: 0.9,
        },
      ],
      FIXTURE_ENTITIES,
      [],
    );

    expect(plan.status).toBe('ready');
    expect(plan.actions.at(-1)?.entity_ids).toEqual(['id1', 'id3']);
    expect(plan.state.entity_ids).toEqual(['id1', 'id3']);
    expect(plan.state.excluded_filters).toHaveLength(1);
  });
});

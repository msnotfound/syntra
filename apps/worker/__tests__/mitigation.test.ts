import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { WatchlistEntity } from '../../../packages/db/models/WatchlistEntity';
import { SupplierLink } from '../../../packages/db/models/SupplierLink';
import { Alert } from '../../../packages/db/models/Alert';
import { Exposure } from '../../../packages/db/models/Exposure';
import { MitigationSuggestion } from '../../../packages/db/models/MitigationSuggestion';
import { Scenario } from '../../../packages/db/models/Scenario';

// Mock packages/llm to avoid network calls
jest.mock('@syntra/llm', () => ({
  callLLMJson: jest.fn(),
  renderTemplate: (t: string, v: Record<string, unknown>) =>
    t.replace(/\{\{(\w+)\}\}/g, (_, k) => String(v[k] ?? '')),
}));

// No-op connectDb — tests manage their own mongoose connection via beforeAll
jest.mock('../../../packages/db/connection', () => ({
  connectDb: jest.fn().mockResolvedValue(undefined),
  disconnectDb: jest.fn().mockResolvedValue(undefined),
}));

// Mock BullMQ queue to avoid Redis connections in tests
jest.mock('../src/workers/scenario-compute.js', () => ({
  getScenarioComputeQueue: jest.fn(() => ({
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  })),
}));

// Mock the LLM module so runMitigationSuggest uses mock fallback
delete process.env.ANTHROPIC_API_KEY;

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await WatchlistEntity.deleteMany({});
  await SupplierLink.deleteMany({});
  await Alert.deleteMany({});
  await Exposure.deleteMany({});
  await MitigationSuggestion.deleteMany({});
  await Scenario.deleteMany({});
});

const ORG = new Types.ObjectId();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeEntity(name: string, type = 'supplier', active = true) {
  return WatchlistEntity.create({
    org_id:             ORG,
    type,
    name,
    country_code:       'IN',
    region:             null,
    latitude:           null,
    longitude:          null,
    metadata:           {},
    active,
    annual_revenue_usd: 5_000_000,
    contribution_pct:   20,
  });
}

async function makeAlert(entityIds: string[], severity: 'critical' | 'high' | 'medium' | 'low' = 'high') {
  return Alert.create({
    org_id:   ORG,
    event_id: new Types.ObjectId(),
    watchlist_entity_ids: entityIds.map(id => new Types.ObjectId(id)),
    severity,
    subtype: 'physical_risk',
    match_reasons: ['country'],
    event_snapshot: {
      title:       'Test Alert Event',
      description: 'Test description for mitigation engine.',
      location:    { lat: 18.96, lng: 72.82 },
      country:     'India',
      country_code: 'IN',
      event_type:  'conflict',
      occurred_at: new Date(),
      sources:     [{ url: 'https://example.com', name: 'Reuters' }],
    },
    llm_context: { why_matters: null, recommended_actions: [] },
    status: 'open',
    assignee_user_id: null,
    comments: [],
    dispatched_at: null,
    channels_sent: [],
    acknowledged_at: null,
    acknowledged_by_user_id: null,
    acknowledgement_note: null,
  });
}

async function link(parentId: string, childId: string, tier: 1 | 2 | 3 = 1) {
  return SupplierLink.create({
    org_id:           ORG,
    parent_entity_id: new Types.ObjectId(parentId),
    child_entity_id:  new Types.ObjectId(childId),
    tier_offset:      tier,
    source:           'manual',
  });
}

// Import after mocks are set
async function getWorker() {
  const mod = await import('../src/workers/mitigation-suggest.js');
  return mod;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mitigation-suggest — graph walk', () => {

  test('1. High-severity alert with no graph — creates alt_route and inventory_buffer suggestions', async () => {
    const entity = await makeEntity('Mumbai Supplier');
    const alert  = await makeAlert([String(entity._id)], 'high');
    const { runMitigationSuggest } = await getWorker();

    const result = await runMitigationSuggest(String(alert._id));

    expect(result.suggestionsCreated).toBeGreaterThanOrEqual(1);
    const suggestions = await MitigationSuggestion.find({ alert_id: alert._id }).lean();
    expect(suggestions.some(s => s.suggestion_type === 'inventory_buffer')).toBe(true);
    suggestions.forEach(s => {
      expect(s.status).toBe('proposed');
      expect(s.org_id.toString()).toBe(ORG.toString());
    });
  });

  test('2. Graph walk: finds tier-1 alternative supplier (sibling of affected)', async () => {
    const parent  = await makeEntity('Parent Buyer');
    const child   = await makeEntity('Affected Supplier');
    const sibling = await makeEntity('Alternative Supplier');

    await link(String(parent._id), String(child._id),   1);
    await link(String(parent._id), String(sibling._id), 1);

    const alert = await makeAlert([String(child._id)], 'high');
    const { runMitigationSuggest } = await getWorker();

    const result = await runMitigationSuggest(String(alert._id));

    const suggestions = await MitigationSuggestion.find({ alert_id: alert._id }).lean();
    const altSupplier = suggestions.find(s => s.suggestion_type === 'alt_supplier');
    expect(altSupplier).toBeDefined();
    expect(altSupplier!.narrative).toContain('Alternative Supplier');
    expect(result.suggestionsCreated).toBeGreaterThanOrEqual(2);
  });

  test('3. Two-tier graph: finds tier-2 alternative (sibling of mid-tier)', async () => {
    const grandParent = await makeEntity('Grand Parent');
    const mid         = await makeEntity('Mid-tier');
    const affected    = await makeEntity('Affected Leaf');
    const altMid      = await makeEntity('Alt Mid-tier');

    await link(String(grandParent._id), String(mid._id),    1);
    await link(String(mid._id),         String(affected._id), 1);
    await link(String(grandParent._id), String(altMid._id), 1);

    const alert = await makeAlert([String(affected._id)], 'critical');
    const { runMitigationSuggest } = await getWorker();

    await runMitigationSuggest(String(alert._id));

    const suggestions = await MitigationSuggestion.find({ alert_id: alert._id }).lean();
    const altSupplier = suggestions.find(s => s.suggestion_type === 'alt_supplier');
    expect(altSupplier).toBeDefined();
    // Alt mid-tier is a sibling of mid-tier (both children of grandParent)
    expect(altSupplier!.narrative).toContain('Alt Mid-tier');
  });

  test('4. Low/medium severity alert — skipped entirely (returns 0 suggestions)', async () => {
    const entity = await makeEntity('Low Risk Entity');
    const alert  = await makeAlert([String(entity._id)], 'medium');
    const { runMitigationSuggest } = await getWorker();

    const result = await runMitigationSuggest(String(alert._id));

    expect(result.suggestionsCreated).toBe(0);
    const count = await MitigationSuggestion.countDocuments({ alert_id: alert._id });
    expect(count).toBe(0);
  });

  test('5. Idempotency: calling twice does not create duplicate suggestions', async () => {
    const entity = await makeEntity('Stable Supplier');
    const alert  = await makeAlert([String(entity._id)], 'high');
    const { runMitigationSuggest } = await getWorker();

    await runMitigationSuggest(String(alert._id));
    const firstCount = await MitigationSuggestion.countDocuments({ alert_id: alert._id });

    await runMitigationSuggest(String(alert._id));
    const secondCount = await MitigationSuggestion.countDocuments({ alert_id: alert._id });

    expect(firstCount).toBe(secondCount);
  });

  test('6. Mock LLM response is used when ANTHROPIC_API_KEY is absent', async () => {
    const entity = await makeEntity('Route Entity', 'route');
    const alert  = await makeAlert([String(entity._id)], 'critical');
    const { runMitigationSuggest } = await getWorker();

    const result = await runMitigationSuggest(String(alert._id));

    // Should still create suggestions via mock
    expect(result.suggestionsCreated).toBeGreaterThan(0);
    const altRoute = await MitigationSuggestion.findOne({ alert_id: alert._id, suggestion_type: 'alt_route' }).lean();
    expect(altRoute).toBeTruthy();
    expect(altRoute!.narrative.length).toBeGreaterThan(10);
  });

  test('7. Scenario re-run: triggered when exposures yield meaningful VaR reduction', async () => {
    const entity = await makeEntity('High VaR Entity');
    const alert  = await makeAlert([String(entity._id)], 'critical');

    // Create exposure with high VaR so estimated reduction > $10K threshold
    await Exposure.create({
      org_id:    ORG,
      entity_id: entity._id,
      alert_id:  alert._id,
      var_value_usd:       500_000,
      var_value_inr:       41_500_000,
      confidence_interval: 0.95,
      methodology:         'test',
      computed_at:         new Date(),
    });

    const { runMitigationSuggest } = await getWorker();
    const result = await runMitigationSuggest(String(alert._id));

    expect(result.scenarioTriggered).toBe(true);
    const scenario = await Scenario.findOne({ org_id: ORG }).lean();
    expect(scenario).toBeTruthy();
    expect(scenario!.name).toContain('Test Alert Event');
  });

});

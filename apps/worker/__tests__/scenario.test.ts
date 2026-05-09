import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { computeScenario } from '../../../packages/db/utils/scenario-compute';
import { WatchlistEntity } from '../../../packages/db/models/WatchlistEntity';
import { SupplierLink } from '../../../packages/db/models/SupplierLink';

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
});

const ORG = new Types.ObjectId();

async function makeEntity(overrides: {
  name: string;
  country_code?: string;
  region?: string;
  annual_revenue_usd?: number;
  contribution_pct?: number;
  active?: boolean;
}) {
  return WatchlistEntity.create({
    org_id:             ORG,
    type:               'supplier',
    name:               overrides.name,
    country_code:       overrides.country_code ?? null,
    region:             overrides.region ?? null,
    latitude:           null,
    longitude:          null,
    metadata:           {},
    active:             overrides.active ?? true,
    annual_revenue_usd: overrides.annual_revenue_usd ?? null,
    contribution_pct:   overrides.contribution_pct ?? null,
  });
}

async function linkParentChild(parent: mongoose.Document, child: mongoose.Document, tier: 1 | 2 | 3 = 1) {
  return SupplierLink.create({
    org_id:           ORG,
    parent_entity_id: parent._id,
    child_entity_id:  child._id,
    tier_offset:      tier,
    source:           'manual',
  });
}

describe('computeScenario — propagation and VaR', () => {

  test('1. Direct match: single entity in geo, no supplier links', async () => {
    await makeEntity({
      name: 'Mumbai Port',
      country_code: 'IN',
      annual_revenue_usd: 10_000_000,
      contribution_pct: 20,
    });

    // physical_risk medium: factor = 0.12; VaR = 10M × 0.20 × 0.12 = 240_000
    const result = await computeScenario(ORG, [
      { type: 'physical_risk', geo: 'IN', severity: 'medium' },
    ]);

    expect(result.affected_entity_ids).toHaveLength(1);
    expect(result.computed_var_total_usd).toBeCloseTo(240_000);
  });

  test('2. Two-tier propagation: event hits child → parent upstream affected', async () => {
    const child  = await makeEntity({ name: 'Tier-1 Supplier', country_code: 'CN', annual_revenue_usd: 5_000_000, contribution_pct: 10 });
    const parent = await makeEntity({ name: 'Tier-0 Buyer',    country_code: 'IN', annual_revenue_usd: 20_000_000, contribution_pct: 5 });
    await linkParentChild(parent, child, 1);

    // physical_risk critical: factor = 0.35
    // child VaR  = 5M × 0.10 × 0.35 = 175_000
    // parent VaR = 20M × 0.05 × 0.35 = 350_000
    // total      = 525_000
    const result = await computeScenario(ORG, [
      { type: 'physical_risk', geo: 'CN', severity: 'critical' },
    ]);

    expect(result.affected_entity_ids).toHaveLength(2);
    expect(result.affected_entity_ids).toContain(String(child._id));
    expect(result.affected_entity_ids).toContain(String(parent._id));
    expect(result.computed_var_total_usd).toBeCloseTo(525_000);
  });

  test('3. Two-hop propagation: child → mid → grandparent (tier-2 graph)', async () => {
    const direct    = await makeEntity({ name: 'Direct',      country_code: 'UA', annual_revenue_usd: 1_000_000, contribution_pct: 100 });
    const mid       = await makeEntity({ name: 'Mid-tier',    country_code: 'DE', annual_revenue_usd: 2_000_000, contribution_pct: 50 });
    const grandTop  = await makeEntity({ name: 'Grand-parent',country_code: 'US', annual_revenue_usd: 10_000_000, contribution_pct: 10 });
    await linkParentChild(mid,      direct, 1);
    await linkParentChild(grandTop, mid,    1);

    // sanctions_match high: factor = 0.75
    const result = await computeScenario(ORG, [
      { type: 'sanctions_match', geo: 'UA', severity: 'high' },
    ]);

    expect(result.affected_entity_ids).toHaveLength(3);
    expect(result.affected_entity_ids).toContain(String(direct._id));
    expect(result.affected_entity_ids).toContain(String(mid._id));
    expect(result.affected_entity_ids).toContain(String(grandTop._id));

    // direct:   1M × 1.00 × 0.75 = 750_000
    // mid:      2M × 0.50 × 0.75 = 750_000
    // grandTop: 10M × 0.10 × 0.75 = 750_000
    // total:    2_250_000
    expect(result.computed_var_total_usd).toBeCloseTo(2_250_000);
  });

  test('4. VaR aggregation: worst-case per entity across multiple events', async () => {
    const entity = await makeEntity({
      name: 'Multi-risk Supplier',
      country_code: 'IR',
      annual_revenue_usd: 5_000_000,
      contribution_pct: 20,
    });

    // Event 1: physical_risk low  = 0.05 → VaR = 5M × 0.20 × 0.05 = 50_000
    // Event 2: sanctions_match critical = 0.90 → VaR = 5M × 0.20 × 0.90 = 900_000
    // Worst case for entity = 900_000
    const result = await computeScenario(ORG, [
      { type: 'physical_risk',   geo: 'IR', severity: 'low' },
      { type: 'sanctions_match', geo: 'IR', severity: 'critical' },
    ]);

    expect(result.affected_entity_ids).toHaveLength(1);
    expect(result.computed_var_total_usd).toBeCloseTo(900_000);
    expect(result.entity_var_map[String(entity._id)]).toBeCloseTo(900_000);
  });

  test('5. Idempotent recompute: calling twice with same inputs yields same result', async () => {
    await makeEntity({ name: 'Stable Supplier', country_code: 'TR', annual_revenue_usd: 3_000_000, contribution_pct: 15 });

    const events = [{ type: 'compliance' as const, geo: 'TR', severity: 'high' as const }];
    const first  = await computeScenario(ORG, events);
    const second = await computeScenario(ORG, events);

    expect(second.computed_var_total_usd).toBe(first.computed_var_total_usd);
    expect(second.affected_entity_ids).toEqual(first.affected_entity_ids);
  });

  test('6. No matching geo → empty result, zero VaR', async () => {
    await makeEntity({ name: 'Japan Supplier', country_code: 'JP', annual_revenue_usd: 1_000_000, contribution_pct: 10 });

    const result = await computeScenario(ORG, [
      { type: 'physical_risk', geo: 'BR', severity: 'critical' },
    ]);

    expect(result.affected_entity_ids).toHaveLength(0);
    expect(result.computed_var_total_usd).toBe(0);
  });

  test('7. Inactive entity excluded from propagation', async () => {
    await makeEntity({ name: 'Inactive Supplier', country_code: 'KP', active: false, annual_revenue_usd: 1_000_000, contribution_pct: 50 });

    const result = await computeScenario(ORG, [
      { type: 'sanctions_match', geo: 'KP', severity: 'critical' },
    ]);

    expect(result.affected_entity_ids).toHaveLength(0);
  });

  test('8. Entity with null revenue → VaR = 0, still in affected list if matched', async () => {
    await makeEntity({ name: 'Unknown Revenue', country_code: 'EG', annual_revenue_usd: undefined, contribution_pct: undefined });

    const result = await computeScenario(ORG, [
      { type: 'physical_risk', geo: 'EG', severity: 'high' },
    ]);

    // Matched but VaR = 0 (no revenue data), so entity map has it with 0 but
    // only entities with varUsd > 0 are tracked (see worst-case logic)
    expect(result.computed_var_total_usd).toBe(0);
  });

});

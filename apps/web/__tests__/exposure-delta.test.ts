import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Exposure } from '../../../packages/db/models/Exposure';
import { InsurancePolicy } from '../../../packages/db/models/InsurancePolicy';
import {
  computeCoverageGap,
  computeDelta,
  computePolicyCoverage,
} from '../../../apps/worker/src/utils/exposure-math';

let mongod: MongoMemoryServer;

const orgId = new mongoose.Types.ObjectId();
const entityId = new mongoose.Types.ObjectId();

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Exposure.deleteMany({});
  await InsurancePolicy.deleteMany({});
});

// ---------------------------------------------------------------------------
// Pure math helpers
// ---------------------------------------------------------------------------

describe('computeCoverageGap', () => {
  test('zero coverage: gap equals var', () => {
    expect(computeCoverageGap(1_000_000, 0)).toBe(1_000_000);
  });

  test('full coverage: gap is zero', () => {
    expect(computeCoverageGap(1_000_000, 100)).toBe(0);
  });

  test('50% coverage: gap is half var', () => {
    expect(computeCoverageGap(1_000_000, 50)).toBe(500_000);
  });

  test('clamps coverage_pct above 100 to 100', () => {
    expect(computeCoverageGap(1_000_000, 150)).toBe(0);
  });

  test('clamps coverage_pct below 0 to 0', () => {
    expect(computeCoverageGap(1_000_000, -10)).toBe(1_000_000);
  });

  test('returns 0 for zero VaR regardless of pct', () => {
    expect(computeCoverageGap(0, 80)).toBe(0);
  });
});

describe('computeDelta', () => {
  test('returns null when no previous value', () => {
    expect(computeDelta(500_000, null)).toBeNull();
  });

  test('positive delta when exposure worsened', () => {
    expect(computeDelta(800_000, 500_000)).toBe(300_000);
  });

  test('negative delta when exposure improved', () => {
    expect(computeDelta(200_000, 500_000)).toBe(-300_000);
  });

  test('zero delta when unchanged', () => {
    expect(computeDelta(500_000, 500_000)).toBe(0);
  });
});

describe('computePolicyCoverage', () => {
  const basePolicy = {
    policy_id: 'POL-001',
    max_payout_usd: 5_000_000,
    deductible_usd: 0,
    aggregate_limit_usd: 4_000_000,
    sub_limits: [],
    exclusions: [],
    claims_history: [],
  };

  test('applies sub_limit for the alert peril kind', () => {
    const result = computePolicyCoverage({
      varUsd: 2_000_000,
      perilKind: 'maritime_attack',
      policy: {
        ...basePolicy,
        sub_limits: [
          { peril_kind: 'sanctions_match', limit_usd: 300_000 },
          { peril_kind: 'maritime_attack', limit_usd: 750_000 },
        ],
      },
    });

    expect(result.coverage_actual_usd).toBe(750_000);
    expect(result.gap_usd).toBe(1_250_000);
    expect(result.exclusion_reason).toBeNull();
  });

  test('aggregate exhaustion leaves zero available coverage', () => {
    const result = computePolicyCoverage({
      varUsd: 800_000,
      perilKind: 'maritime_attack',
      policy: {
        ...basePolicy,
        aggregate_limit_usd: 1_000_000,
        claims_history: [
          { claim_id: 'CLM-001', paid_usd: 650_000, denied: false, date: new Date('2026-01-01') },
          { claim_id: 'CLM-002', paid_usd: 350_000, denied: false, date: new Date('2026-02-01') },
        ],
      },
    });

    expect(result.coverage_actual_usd).toBe(0);
    expect(result.gap_usd).toBe(800_000);
  });

  test('exclusion zeroes coverage and returns the exclusion reason', () => {
    const result = computePolicyCoverage({
      varUsd: 900_000,
      perilKind: 'sanctions_match',
      policy: {
        ...basePolicy,
        exclusions: [
          { peril_kind: 'sanctions_match', reason: 'OFAC sanctions are excluded from this schedule.' },
        ],
      },
    });

    expect(result.coverage_actual_usd).toBe(0);
    expect(result.gap_usd).toBe(900_000);
    expect(result.exclusion_reason).toBe('OFAC sanctions are excluded from this schedule.');
  });

  test('paid non-denied claims reduce aggregate availability', () => {
    const result = computePolicyCoverage({
      varUsd: 1_500_000,
      perilKind: 'port_closure',
      policy: {
        ...basePolicy,
        aggregate_limit_usd: 2_000_000,
        claims_history: [
          { claim_id: 'CLM-PAID', paid_usd: 1_200_000, denied: false, date: new Date('2026-01-01') },
          { claim_id: 'CLM-DENIED', paid_usd: 700_000, denied: true, date: new Date('2026-02-01') },
        ],
      },
    });

    expect(result.coverage_actual_usd).toBe(800_000);
    expect(result.gap_usd).toBe(700_000);
  });
});

// ---------------------------------------------------------------------------
// Schema: insurance fields on Exposure documents
// ---------------------------------------------------------------------------

describe('Exposure schema — insurance fields', () => {
  function makeExposure(overrides = {}) {
    return {
      org_id: orgId,
      entity_id: entityId,
      alert_id: null,
      var_value_usd: 1_000_000,
      var_value_inr: 84_000_000,
      confidence_interval: 0.95,
      methodology: 'test',
      computed_at: new Date(),
      ...overrides,
    };
  }

  test('new exposure defaults to insurance_coverage_pct=0', async () => {
    const exp = await Exposure.create(makeExposure());
    expect(exp.insurance_coverage_pct).toBe(0);
  });

  test('new exposure defaults to policy_id=null', async () => {
    const exp = await Exposure.create(makeExposure());
    expect(exp.policy_id).toBeNull();
  });

  test('new exposure defaults to coverage_gap_usd=0', async () => {
    const exp = await Exposure.create(makeExposure());
    expect(exp.coverage_gap_usd).toBe(0);
  });

  test('new exposure defaults to coverage_actual_usd=0', async () => {
    const exp = await Exposure.create(makeExposure());
    expect(exp.coverage_actual_usd).toBe(0);
  });

  test('new exposure defaults to exclusion_reason=null', async () => {
    const exp = await Exposure.create(makeExposure());
    expect(exp.exclusion_reason).toBeNull();
  });

  test('new exposure defaults to exposure_delta_usd=null', async () => {
    const exp = await Exposure.create(makeExposure());
    expect(exp.exposure_delta_usd).toBeNull();
  });

  test('stores insurance fields when provided', async () => {
    const exp = await Exposure.create(makeExposure({
      insurance_coverage_pct: 60,
      policy_id: 'POL-001',
      coverage_actual_usd: 600_000,
      coverage_gap_usd: 400_000,
      exclusion_reason: 'excluded peril',
      exposure_delta_usd: 100_000,
    }));
    expect(exp.insurance_coverage_pct).toBe(60);
    expect(exp.policy_id).toBe('POL-001');
    expect(exp.coverage_actual_usd).toBe(600_000);
    expect(exp.coverage_gap_usd).toBe(400_000);
    expect(exp.exclusion_reason).toBe('excluded peril');
    expect(exp.exposure_delta_usd).toBe(100_000);
  });

  test('rejects insurance_coverage_pct > 100', async () => {
    await expect(
      Exposure.create(makeExposure({ insurance_coverage_pct: 110 })),
    ).rejects.toThrow();
  });

  test('rejects insurance_coverage_pct < 0', async () => {
    await expect(
      Exposure.create(makeExposure({ insurance_coverage_pct: -5 })),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// InsurancePolicy schema
// ---------------------------------------------------------------------------

describe('InsurancePolicy schema', () => {
  function makePolicy(overrides = {}) {
    return {
      org_id: orgId,
      policy_id: 'POL-2024-001',
      insurer_name: 'ICICI Lombard',
      coverage_type: 'marine' as const,
      max_payout_usd: 5_000_000,
      deductible_usd: 50_000,
      expires_at: new Date(Date.now() + 365 * 86_400_000),
      ...overrides,
    };
  }

  test('creates a policy successfully', async () => {
    const p = await InsurancePolicy.create(makePolicy());
    expect(p.policy_id).toBe('POL-2024-001');
    expect(p.coverage_type).toBe('marine');
    expect(p.aggregate_limit_usd).toBe(5_000_000);
    expect(p.sub_limits).toEqual([]);
    expect(p.exclusions).toEqual([]);
    expect(p.claims_history).toEqual([]);
  });

  test('stores sub-limits, exclusions, and claims history', async () => {
    const p = await InsurancePolicy.create(makePolicy({
      aggregate_limit_usd: 4_000_000,
      sub_limits: [{ peril_kind: 'maritime_attack', limit_usd: 750_000 }],
      exclusions: [{ peril_kind: 'sanctions_match', reason: 'Sanctions excluded' }],
      claims_history: [{ claim_id: 'CLM-001', paid_usd: 250_000, denied: false, date: new Date('2026-01-01') }],
    }));

    expect(p.aggregate_limit_usd).toBe(4_000_000);
    expect(p.sub_limits[0]?.peril_kind).toBe('maritime_attack');
    expect(p.exclusions[0]?.reason).toBe('Sanctions excluded');
    expect(p.claims_history[0]?.paid_usd).toBe(250_000);
  });

  test('enforces unique policy_id within org', async () => {
    await InsurancePolicy.create(makePolicy());
    await expect(InsurancePolicy.create(makePolicy())).rejects.toThrow();
  });

  test('allows same policy_id across different orgs', async () => {
    const otherOrgId = new mongoose.Types.ObjectId();
    await InsurancePolicy.create(makePolicy());
    const p2 = await InsurancePolicy.create(makePolicy({ org_id: otherOrgId }));
    expect(p2.policy_id).toBe('POL-2024-001');
  });

  test('rejects negative max_payout_usd', async () => {
    await expect(
      InsurancePolicy.create(makePolicy({ max_payout_usd: -1 })),
    ).rejects.toThrow();
  });

  test('rejects invalid coverage_type', async () => {
    await expect(
      InsurancePolicy.create(makePolicy({ coverage_type: 'asteroid' })),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Delta + gap computation: integration
// ---------------------------------------------------------------------------

describe('coverage gap computation — integration', () => {
  test('gap reflects partial coverage correctly', () => {
    const varUsd = 2_000_000;
    const coveragePct = 75;
    const gap = computeCoverageGap(varUsd, coveragePct);
    expect(gap).toBeCloseTo(500_000, 0);
  });

  test('two consecutive exposures: delta tracks change', () => {
    const first = 1_000_000;
    const second = 1_500_000;
    const delta = computeDelta(second, first);
    expect(delta).toBe(500_000);
  });

  test('improvement shows negative delta', () => {
    const delta = computeDelta(700_000, 1_000_000);
    expect(delta).toBe(-300_000);
  });
});

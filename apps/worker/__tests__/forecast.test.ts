import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { LeadingIndicator } from '@syntra/db';
import { Forecast } from '../../../packages/db/models/Forecast';
import { IntelClaim } from '../../../packages/db/models/IntelClaim';
import { VesselPosition } from '../../../packages/db/models/VesselPosition';
import { Organization } from '../../../packages/db/models/Organization';
import { computeBrierScore } from '../src/workers/forecast-resolve';
import { computeThreshold } from '../src/cron/forecast-compute';

jest.mock('@syntra/llm', () => ({
  callLLMJson: jest.fn(),
  renderTemplate: (t: string, v: Record<string, unknown>) =>
    t.replace(/\{\{(\w+)\}\}/g, (_, k) => String(v[k] ?? '')),
}));

jest.mock('../../../packages/db/connection', () => ({
  connectDb:    jest.fn().mockResolvedValue(undefined),
  disconnectDb: jest.fn().mockResolvedValue(undefined),
}));

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
  await LeadingIndicator.deleteMany({});
  await Forecast.deleteMany({});
  await IntelClaim.deleteMany({});
  await VesselPosition.deleteMany({});
  await Organization.deleteMany({});
});

// ---------------------------------------------------------------------------
// Brier score math — must cover at least 4 cases per spec
// ---------------------------------------------------------------------------

describe('computeBrierScore', () => {
  // Case 1: perfect forecast that occurred
  it('p=100, occurred → 0 (perfect)', () => {
    expect(computeBrierScore(100, true)).toBeCloseTo(0);
  });

  // Case 2: p=70, occurred → (0.7-1)^2 = 0.09
  it('p=70, occurred → 0.09', () => {
    expect(computeBrierScore(70, true)).toBeCloseTo(0.09);
  });

  // Case 3: p=30, did_not_occur → (0.3-0)^2 = 0.09
  it('p=30, did_not_occur → 0.09', () => {
    expect(computeBrierScore(30, false)).toBeCloseTo(0.09);
  });

  // Case 4: coin-flip
  it('p=50, occurred → 0.25 (coin flip)', () => {
    expect(computeBrierScore(50, true)).toBeCloseTo(0.25);
  });

  // Case 5: completely wrong confident forecast
  it('p=100, did_not_occur → 1 (worst miss)', () => {
    expect(computeBrierScore(100, false)).toBeCloseTo(1);
  });

  // Case 6: overconfident wrong
  it('p=80, did_not_occur → 0.64', () => {
    // (0.8 - 0)^2 = 0.64
    expect(computeBrierScore(80, false)).toBeCloseTo(0.64);
  });

  // Case 7: perfect non-occurrence
  it('p=0, did_not_occur → 0 (perfect non-occurrence)', () => {
    expect(computeBrierScore(0, false)).toBeCloseTo(0);
  });

  // Case 8: p=0, occurred → 1 (worst possible miss)
  it('p=0, occurred → 1', () => {
    expect(computeBrierScore(0, true)).toBeCloseTo(1);
  });
});

// ---------------------------------------------------------------------------
// Threshold computation
// ---------------------------------------------------------------------------

describe('computeThreshold', () => {
  it('exactly at baseline → normal', () => {
    expect(computeThreshold(0.20, 0.20, 0.10)).toBe('normal');
  });

  it('1.1σ above baseline → elevated', () => {
    // base=0.2, sigma=0.1, current=0.31 → (0.31-0.2)/0.1 = 1.1 → elevated
    expect(computeThreshold(0.31, 0.20, 0.10)).toBe('elevated');
  });

  it('2.1σ above baseline → critical', () => {
    // base=0.2, sigma=0.1, current=0.41 → 2.1 → critical
    expect(computeThreshold(0.41, 0.20, 0.10)).toBe('critical');
  });

  it('below baseline → normal', () => {
    expect(computeThreshold(0.10, 0.20, 0.10)).toBe('normal');
  });

  it('sigma=0 → always normal (avoids division by zero)', () => {
    expect(computeThreshold(0.99, 0.10, 0)).toBe('normal');
  });

  it('exactly 2σ → elevated (boundary is exclusive: >2 = critical)', () => {
    // exactly 2σ: (0.4 - 0.2) / 0.1 = 2.0 — not > 2, so elevated
    expect(computeThreshold(0.40, 0.20, 0.10)).toBe('elevated');
  });
});

// ---------------------------------------------------------------------------
// Forecast idempotency
// ---------------------------------------------------------------------------

describe('forecast idempotency', () => {
  it('duplicate upsert does not create two documents', async () => {
    const orgId       = new Types.ObjectId();
    const indicatorId = new Types.ObjectId();
    const expiresAt   = new Date(Date.now() + 14 * 86400_000);

    await Forecast.create({
      org_id:             orgId,
      indicator_id:       indicatorId,
      indicator_type:     'port-congestion',
      target_entity_id:   null,
      probability_pct:    65,
      time_horizon_days:  14,
      supporting_claims:  [],
      narrative:          'Initial forecast',
      recommended_action: 'Test action',
      computed_at:        new Date(),
      expires_at:         expiresAt,
      methodology:        'Test methodology',
      actual_outcome:     null,
      brier_score:        null,
    });

    // Second upsert with same composite key — must not insert a new doc
    try {
      await Forecast.findOneAndUpdate(
        { org_id: orgId, indicator_id: indicatorId, expires_at: expiresAt },
        { $setOnInsert: { probability_pct: 80 } },
        { upsert: true, new: false },
      );
    } catch (err: unknown) {
      if ((err as { code?: number }).code !== 11000) throw err;
    }

    const count = await Forecast.countDocuments({ org_id: orgId, indicator_id: indicatorId });
    expect(count).toBe(1);

    // Original probability preserved
    const doc = await Forecast.findOne({ org_id: orgId, indicator_id: indicatorId }).lean();
    expect(doc?.probability_pct).toBe(65);
  });
});

// ---------------------------------------------------------------------------
// Indicator seeding
// ---------------------------------------------------------------------------

describe('seedLeadingIndicators', () => {
  it('seeds exactly 8 system indicators', async () => {
    const { seedLeadingIndicators } = await import('@syntra/db');
    await seedLeadingIndicators();
    const count = await LeadingIndicator.countDocuments({ org_id: 'system' });
    expect(count).toBe(8);
  });

  it('seeding twice is idempotent', async () => {
    const { seedLeadingIndicators } = await import('@syntra/db');
    await seedLeadingIndicators();
    await seedLeadingIndicators();
    const count = await LeadingIndicator.countDocuments({ org_id: 'system' });
    expect(count).toBe(8);
  });

  it('all 8 indicators have required fields populated', async () => {
    const { seedLeadingIndicators } = await import('@syntra/db');
    await seedLeadingIndicators();
    const indicators = await LeadingIndicator.find({}).lean();
    for (const ind of indicators) {
      expect(ind.name).toBeTruthy();
      expect(ind.description).toBeTruthy();
      expect(ind.formula_doc).toBeTruthy();
      expect(ind.source_modules.length).toBeGreaterThan(0);
      expect(ind.threshold_breach).toBe('normal');
    }
  });
});

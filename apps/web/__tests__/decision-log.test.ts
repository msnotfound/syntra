import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Decision } from '../../../packages/db/models/Decision';
import { Alert } from '../../../packages/db/models/Alert';
import { User } from '../../../packages/db/models/User';
import { Organization } from '../../../packages/db/models/Organization';

let mongod: MongoMemoryServer;

const orgId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const alertId = new mongoose.Types.ObjectId();

function makeDecisionData(overrides = {}) {
  return {
    org_id: orgId,
    alert_id: alertId,
    user_id: userId,
    decision_type: 'acknowledged' as const,
    decision_text: 'Reviewed and acknowledged the risk.',
    justification: 'Supplier confirmed no direct exposure.',
    made_at: new Date(),
    ...overrides,
  };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  await Organization.create({
    _id: orgId,
    name: 'Test Org',
    slug: 'test-org',
    plan: 'growth',
    status: 'active',
    trial_ends_at: new Date(Date.now() + 86400000),
    contact_email: 'test@test.com',
    settings: {
      alert_channels: ['email'],
      webhook_url: null,
      severity_threshold: 'low',
      quiet_hours_start: null,
      quiet_hours_end: null,
      timezone: 'Asia/Kolkata',
    },
    demo_mode: false,
  });

  await User.create({
    _id: userId,
    clerk_user_id: 'user_decision_1',
    email: 'dec@test.com',
    name: 'Dec User',
    org_id: orgId,
    role: 'admin',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Decision.deleteMany({});
});

// ─── Append-only enforcement ─────────────────────────────────────────────────

describe('Decision — append-only enforcement', () => {
  test('creates a decision successfully', async () => {
    const doc = await Decision.create(makeDecisionData());
    expect(String(doc._id)).toBeTruthy();
    expect(doc.decision_type).toBe('acknowledged');
    expect(doc.decision_text).toBe('Reviewed and acknowledged the risk.');
  });

  test('updateOne is blocked by pre-hook', async () => {
    await Decision.create(makeDecisionData());
    await expect(
      Decision.updateOne({ org_id: orgId }, { decision_text: 'tampered' }),
    ).rejects.toThrow('append-only');
  });

  test('findOneAndUpdate is blocked by pre-hook', async () => {
    const doc = await Decision.create(makeDecisionData());
    await expect(
      Decision.findOneAndUpdate({ _id: doc._id }, { decision_text: 'tampered' }),
    ).rejects.toThrow('append-only');
  });

  test('schema has no updatedAt field', async () => {
    const doc = await Decision.create(makeDecisionData());
    const raw = await Decision.findById(doc._id).lean();
    expect((raw as Record<string, unknown>).updatedAt).toBeUndefined();
  });
});

// ─── Schema validation ────────────────────────────────────────────────────────

describe('Decision — schema validation', () => {
  test('rejects invalid decision_type', async () => {
    await expect(
      Decision.create(makeDecisionData({ decision_type: 'invalid_type' })),
    ).rejects.toThrow();
  });

  test('requires decision_text', async () => {
    await expect(
      Decision.create({ ...makeDecisionData(), decision_text: undefined }),
    ).rejects.toThrow();
  });

  test('requires org_id', async () => {
    await expect(
      Decision.create({ ...makeDecisionData(), org_id: undefined }),
    ).rejects.toThrow();
  });

  test('requires alert_id', async () => {
    await expect(
      Decision.create({ ...makeDecisionData(), alert_id: undefined }),
    ).rejects.toThrow();
  });

  test('requires user_id', async () => {
    await expect(
      Decision.create({ ...makeDecisionData(), user_id: undefined }),
    ).rejects.toThrow();
  });

  test('justification defaults to empty string', async () => {
    const doc = await Decision.create({ ...makeDecisionData(), justification: undefined });
    expect(doc.justification).toBe('');
  });

  test('accepts all valid decision_type values', async () => {
    const types = ['acknowledged', 'assigned', 'closed', 'escalated', 'mitigation_chosen'] as const;
    for (const t of types) {
      const doc = await Decision.create(makeDecisionData({ decision_type: t }));
      expect(doc.decision_type).toBe(t);
    }
  });
});

// ─── Query correctness ────────────────────────────────────────────────────────

describe('Decision — query correctness', () => {
  test('filters by org_id', async () => {
    const otherOrg = new mongoose.Types.ObjectId();
    await Decision.create(makeDecisionData());
    await Decision.create(makeDecisionData({ org_id: otherOrg }));

    const mine = await Decision.find({ org_id: orgId }).lean();
    expect(mine).toHaveLength(1);
    expect(String(mine[0].org_id)).toBe(String(orgId));
  });

  test('filters by alert_id', async () => {
    const otherId = new mongoose.Types.ObjectId();
    await Decision.create(makeDecisionData());
    await Decision.create(makeDecisionData({ alert_id: otherId }));

    const result = await Decision.find({ org_id: orgId, alert_id: alertId }).lean();
    expect(result).toHaveLength(1);
  });

  test('filters by user_id', async () => {
    const otherId = new mongoose.Types.ObjectId();
    await Decision.create(makeDecisionData());
    await Decision.create(makeDecisionData({ user_id: otherId }));

    const result = await Decision.find({ org_id: orgId, user_id: userId }).lean();
    expect(result).toHaveLength(1);
  });

  test('filters by decision_type', async () => {
    await Decision.create(makeDecisionData({ decision_type: 'acknowledged' }));
    await Decision.create(makeDecisionData({ decision_type: 'closed' }));
    await Decision.create(makeDecisionData({ decision_type: 'escalated' }));

    const closed = await Decision.find({ org_id: orgId, decision_type: 'closed' }).lean();
    expect(closed).toHaveLength(1);
    expect(closed[0].decision_type).toBe('closed');
  });

  test('filters by made_at range', async () => {
    const past = new Date('2024-01-01T00:00:00Z');
    const recent = new Date('2025-06-01T00:00:00Z');
    await Decision.create(makeDecisionData({ made_at: past }));
    await Decision.create(makeDecisionData({ made_at: recent }));

    const result = await Decision.find({
      org_id: orgId,
      made_at: { $gte: new Date('2025-01-01'), $lte: new Date('2025-12-31') },
    }).lean();

    expect(result).toHaveLength(1);
    expect(result[0].made_at.toISOString()).toBe(recent.toISOString());
  });

  test('sorted by made_at descending', async () => {
    const t1 = new Date('2025-01-01');
    const t2 = new Date('2025-03-01');
    const t3 = new Date('2025-06-01');
    await Decision.create(makeDecisionData({ made_at: t1 }));
    await Decision.create(makeDecisionData({ made_at: t3 }));
    await Decision.create(makeDecisionData({ made_at: t2 }));

    const result = await Decision.find({ org_id: orgId }).sort({ made_at: -1 }).lean();
    expect(result[0].made_at.toISOString()).toBe(t3.toISOString());
    expect(result[1].made_at.toISOString()).toBe(t2.toISOString());
    expect(result[2].made_at.toISOString()).toBe(t1.toISOString());
  });

  test('pagination with skip + limit', async () => {
    for (let i = 0; i < 5; i++) {
      await Decision.create(makeDecisionData({ made_at: new Date(Date.now() + i * 1000) }));
    }

    const page1 = await Decision.find({ org_id: orgId }).sort({ made_at: -1 }).limit(2).skip(0).lean();
    const page2 = await Decision.find({ org_id: orgId }).sort({ made_at: -1 }).limit(2).skip(2).lean();

    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    expect(String(page1[0]._id)).not.toBe(String(page2[0]._id));
  });

  test('countDocuments with org filter', async () => {
    const other = new mongoose.Types.ObjectId();
    await Decision.create(makeDecisionData());
    await Decision.create(makeDecisionData());
    await Decision.create(makeDecisionData({ org_id: other }));

    const count = await Decision.countDocuments({ org_id: orgId });
    expect(count).toBe(2);
  });
});

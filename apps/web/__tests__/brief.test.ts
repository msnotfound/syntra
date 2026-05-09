import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createHash, randomBytes } from 'crypto';
import { RiskBrief } from '../../../packages/db/models/RiskBrief';
import { Organization } from '../../../packages/db/models/Organization';
import { User } from '../../../packages/db/models/User';
import { Alert } from '../../../packages/db/models/Alert';

let mongod: MongoMemoryServer;

const orgId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const alertId = new mongoose.Types.ObjectId();

const MOCK_CONTENT = {
  executive_summary: 'A high-severity event threatens supply chain operations.',
  situation_overview: 'Port closures reported near major trade route.',
  operational_impact: 'Expected delays of 2-4 weeks for affected shipments.',
  recommended_actions_prose: 'Reroute cargo through alternate port. Notify buyers.',
  severity: 'high',
  var_exposure_inr: 42_000_000,
  alert_title: 'Port Closure — Mumbai',
  entity_name: null,
  org_name: 'Test Corp',
  affected_entities: [{ name: 'JNPT Mumbai', type: 'port' }],
  generated_at: new Date(),
};

function makeToken() {
  const raw = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

function makeBriefData(overrides = {}) {
  const { raw, hash } = makeToken();
  return {
    org_id: orgId,
    alert_id: alertId,
    entity_id: null,
    share_token: raw,
    share_token_hash: hash,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    created_by: userId,
    view_count: 0,
    content: MOCK_CONTENT,
    ...overrides,
  };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  await Organization.create({
    _id: orgId,
    name: 'Test Corp',
    slug: 'test-corp',
    plan: 'growth',
    status: 'active',
    trial_ends_at: new Date(Date.now() + 86400000),
    contact_email: 'test@corp.com',
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
    clerk_user_id: 'user_m26_test',
    email: 'ops@corp.com',
    name: 'Ops User',
    org_id: orgId,
    role: 'member',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await RiskBrief.deleteMany({});
});

describe('RiskBrief — schema and creation', () => {
  test('creates a brief with all required fields', async () => {
    const brief = await RiskBrief.create(makeBriefData());
    expect(brief).toBeDefined();
    expect(String(brief.org_id)).toBe(String(orgId));
    expect(brief.view_count).toBe(0);
    expect(brief.share_token).toHaveLength(64);
    expect(brief.share_token_hash).toHaveLength(64);
    expect(brief.content.severity).toBe('high');
    expect(brief.content.org_name).toBe('Test Corp');
  });

  test('share_token_hash is indexed and unique', async () => {
    const data = makeBriefData();
    await RiskBrief.create(data);
    await expect(RiskBrief.create({ ...makeBriefData(), share_token_hash: data.share_token_hash }))
      .rejects.toThrow();
  });

  test('org isolation: cannot query another org brief', async () => {
    await RiskBrief.create(makeBriefData());
    const other = new mongoose.Types.ObjectId();
    const result = await RiskBrief.findOne({ org_id: other });
    expect(result).toBeNull();
  });

  test('created_at is auto-populated', async () => {
    const brief = await RiskBrief.create(makeBriefData());
    expect(brief.created_at).toBeInstanceOf(Date);
  });
});

describe('RiskBrief — share token lookup', () => {
  test('can find a brief by hashed share token', async () => {
    const { raw, hash } = makeToken();
    await RiskBrief.create(makeBriefData({ share_token: raw, share_token_hash: hash }));

    const lookupHash = createHash('sha256').update(raw).digest('hex');
    const found = await RiskBrief.findOne({ share_token_hash: lookupHash });
    expect(found).not.toBeNull();
    expect(found?.share_token).toBe(raw);
  });

  test('lookup with wrong token returns null', async () => {
    await RiskBrief.create(makeBriefData());
    const fakeHash = createHash('sha256').update('bad-token').digest('hex');
    const found = await RiskBrief.findOne({ share_token_hash: fakeHash });
    expect(found).toBeNull();
  });
});

describe('RiskBrief — expiry enforcement', () => {
  test('expired briefs are excluded when filtering by expires_at > now', async () => {
    const expiredData = makeBriefData({
      expires_at: new Date(Date.now() - 1000),
    });
    await RiskBrief.create(expiredData);

    const found = await RiskBrief.findOne({
      org_id: orgId,
      expires_at: { $gt: new Date() },
    });
    expect(found).toBeNull();
  });

  test('valid briefs are returned when not yet expired', async () => {
    await RiskBrief.create(makeBriefData());
    const found = await RiskBrief.findOne({
      org_id: orgId,
      expires_at: { $gt: new Date() },
    });
    expect(found).not.toBeNull();
  });
});

describe('RiskBrief — view count', () => {
  test('view_count defaults to 0', async () => {
    const brief = await RiskBrief.create(makeBriefData());
    expect(brief.view_count).toBe(0);
  });

  test('$inc increments view_count atomically', async () => {
    const brief = await RiskBrief.create(makeBriefData());
    await RiskBrief.findByIdAndUpdate(brief._id, { $inc: { view_count: 1 } });
    await RiskBrief.findByIdAndUpdate(brief._id, { $inc: { view_count: 1 } });
    const updated = await RiskBrief.findById(brief._id).lean();
    expect(updated?.view_count).toBe(2);
  });

  test('view count incremented on token lookup (simulated)', async () => {
    const { raw, hash } = makeToken();
    await RiskBrief.create(makeBriefData({ share_token: raw, share_token_hash: hash }));

    const lookupHash = createHash('sha256').update(raw).digest('hex');
    const updated = await RiskBrief.findOneAndUpdate(
      { share_token_hash: lookupHash, expires_at: { $gt: new Date() } },
      { $inc: { view_count: 1 } },
      { new: true },
    );
    expect(updated?.view_count).toBe(1);
  });
});

describe('RiskBrief — content fields', () => {
  test('content stores all narrative sections', async () => {
    const brief = await RiskBrief.create(makeBriefData());
    expect(brief.content.executive_summary).toBeTruthy();
    expect(brief.content.situation_overview).toBeTruthy();
    expect(brief.content.operational_impact).toBeTruthy();
    expect(brief.content.recommended_actions_prose).toBeTruthy();
  });

  test('var_exposure_inr can be null', async () => {
    const brief = await RiskBrief.create(makeBriefData({
      content: { ...MOCK_CONTENT, var_exposure_inr: null },
    }));
    expect(brief.content.var_exposure_inr).toBeNull();
  });

  test('affected_entities is stored correctly', async () => {
    const brief = await RiskBrief.create(makeBriefData());
    expect(brief.content.affected_entities).toHaveLength(1);
    expect(brief.content.affected_entities[0]?.name).toBe('JNPT Mumbai');
    expect(brief.content.affected_entities[0]?.type).toBe('port');
  });
});

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Alert } from '../../../packages/db/models/Alert';
import { User } from '../../../packages/db/models/User';
import { Organization } from '../../../packages/db/models/Organization';

let mongod: MongoMemoryServer;

const orgId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const userId2 = new mongoose.Types.ObjectId();
const eventId = new mongoose.Types.ObjectId();

function makeAlertData(overrides = {}) {
  return {
    org_id: orgId,
    event_id: new mongoose.Types.ObjectId(),
    watchlist_entity_ids: [],
    severity: 'high' as const,
    match_reasons: ['country' as const],
    event_snapshot: {
      title: 'Test Alert',
      description: 'A test alert event',
      location: { lat: 19.076, lng: 72.877 },
      country: 'India',
      country_code: 'IN',
      event_type: 'conflict',
      occurred_at: new Date(),
      sources: [],
    },
    llm_context: { why_matters: null, recommended_actions: [] },
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
    clerk_user_id: 'user_test_1',
    email: 'user1@test.com',
    name: 'Alice',
    org_id: orgId,
    role: 'admin',
  });

  await User.create({
    _id: userId2,
    clerk_user_id: 'user_test_2',
    email: 'user2@test.com',
    name: 'Bob',
    org_id: orgId,
    role: 'member',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Alert.deleteMany({});
});

describe('Alert triage — status field', () => {
  test('new alert defaults to status=open', async () => {
    const alert = await Alert.create(makeAlertData());
    expect(alert.status).toBe('open');
  });

  test('status transitions: open → triaged → closed', async () => {
    const alert = await Alert.create(makeAlertData());

    await Alert.updateOne({ _id: alert._id }, { status: 'triaged' });
    const triaged = await Alert.findById(alert._id).lean();
    expect(triaged?.status).toBe('triaged');

    await Alert.updateOne({ _id: alert._id }, { status: 'closed' });
    const closed = await Alert.findById(alert._id).lean();
    expect(closed?.status).toBe('closed');
  });

  test('invalid status is rejected by mongoose enum', async () => {
    const alert = await Alert.create(makeAlertData());
    await expect(
      Alert.findByIdAndUpdate(alert._id, { status: 'invalid_status' }, { runValidators: true, new: true })
    ).rejects.toThrow();
  });

  test('status can be reopened: closed → open', async () => {
    const alert = await Alert.create(makeAlertData({ status: 'closed' }));
    await Alert.updateOne({ _id: alert._id }, { status: 'open' });
    const reopened = await Alert.findById(alert._id).lean();
    expect(reopened?.status).toBe('open');
  });
});

describe('Alert triage — assignment', () => {
  test('alert assignee defaults to null', async () => {
    const alert = await Alert.create(makeAlertData());
    expect(alert.assignee_user_id).toBeNull();
  });

  test('assign a user to an alert', async () => {
    const alert = await Alert.create(makeAlertData());

    const updated = await Alert.findByIdAndUpdate(
      alert._id,
      { assignee_user_id: userId },
      { new: true }
    ).lean();

    expect(String(updated?.assignee_user_id)).toBe(String(userId));
  });

  test('unassign by setting assignee_user_id to null', async () => {
    const alert = await Alert.create(makeAlertData({ assignee_user_id: userId }));

    const updated = await Alert.findByIdAndUpdate(
      alert._id,
      { assignee_user_id: null },
      { new: true }
    ).lean();

    expect(updated?.assignee_user_id).toBeNull();
  });

  test('org isolation: cannot fetch alert from a different org', async () => {
    const otherOrgId = new mongoose.Types.ObjectId();
    const alert = await Alert.create(makeAlertData());

    const result = await Alert.findOne({ _id: alert._id, org_id: otherOrgId }).lean();
    expect(result).toBeNull();
  });
});

describe('Alert triage — comments', () => {
  test('alert has empty comments by default', async () => {
    const alert = await Alert.create(makeAlertData());
    expect(alert.comments).toHaveLength(0);
  });

  test('push a comment to an alert', async () => {
    const alert = await Alert.create(makeAlertData());
    const now = new Date();

    const updated = await Alert.findByIdAndUpdate(
      alert._id,
      { $push: { comments: { user_id: userId, body: 'Investigating now.', created_at: now } } },
      { new: true }
    ).lean();

    expect(updated?.comments).toHaveLength(1);
    expect(updated?.comments[0]?.body).toBe('Investigating now.');
    expect(String(updated?.comments[0]?.user_id)).toBe(String(userId));
  });

  test('multiple comments accumulate in order', async () => {
    const alert = await Alert.create(makeAlertData());

    await Alert.findByIdAndUpdate(
      alert._id,
      { $push: { comments: { user_id: userId, body: 'First comment', created_at: new Date() } } },
    );
    await Alert.findByIdAndUpdate(
      alert._id,
      { $push: { comments: { user_id: userId2, body: 'Second comment', created_at: new Date() } } },
    );

    const final = await Alert.findById(alert._id).lean();
    expect(final?.comments).toHaveLength(2);
    expect(final?.comments[0]?.body).toBe('First comment');
    expect(final?.comments[1]?.body).toBe('Second comment');
    expect(String(final?.comments[1]?.user_id)).toBe(String(userId2));
  });

  test('comment body is required', async () => {
    const alert = await Alert.create(makeAlertData());

    await expect(
      Alert.findByIdAndUpdate(
        alert._id,
        { $push: { comments: { user_id: userId, created_at: new Date() } } },
        { new: true, runValidators: true }
      )
    ).rejects.toThrow();
  });
});

describe('Alert triage — subtype field', () => {
  test('new alert defaults to subtype=physical_risk', async () => {
    const alert = await Alert.create(makeAlertData());
    expect(alert.subtype).toBe('physical_risk');
  });

  test('subtype can be set to sanctions_match', async () => {
    const alert = await Alert.create(makeAlertData({ subtype: 'sanctions_match' }));
    expect(alert.subtype).toBe('sanctions_match');
  });
});

describe('Alert triage — combined flow', () => {
  test('full triage lifecycle: create → assign → comment → close', async () => {
    const alert = await Alert.create(makeAlertData());
    expect(alert.status).toBe('open');

    // Assign
    const assigned = await Alert.findByIdAndUpdate(
      alert._id,
      { assignee_user_id: userId, status: 'triaged' },
      { new: true }
    ).lean();
    expect(assigned?.status).toBe('triaged');
    expect(String(assigned?.assignee_user_id)).toBe(String(userId));

    // Comment
    await Alert.findByIdAndUpdate(
      alert._id,
      { $push: { comments: { user_id: userId, body: 'Route alternate identified.', created_at: new Date() } } }
    );

    // Close
    const closed = await Alert.findByIdAndUpdate(
      alert._id,
      { status: 'closed' },
      { new: true }
    ).lean();
    expect(closed?.status).toBe('closed');
    expect(closed?.comments).toHaveLength(1);
    expect(String(closed?.assignee_user_id)).toBe(String(userId));
  });
});

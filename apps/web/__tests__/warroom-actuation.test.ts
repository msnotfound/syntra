import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { WarRoom } from '../../../packages/db/models/WarRoom';
import { WarRoomMessage } from '../../../packages/db/models/WarRoomMessage';
import { WarRoomActionItem } from '../../../packages/db/models/WarRoomActionItem';
import { Alert } from '../../../packages/db/models/Alert';
import { Decision } from '../../../packages/db/models/Decision';
import { MitigationSuggestion } from '../../../packages/db/models/MitigationSuggestion';
import { Organization } from '../../../packages/db/models/Organization';
import { User } from '../../../packages/db/models/User';
import { Event } from '../../../packages/db/models/Event';

let mongod: MongoMemoryServer;

const orgId   = new mongoose.Types.ObjectId();
const userId  = new mongoose.Types.ObjectId();
const userId2 = new mongoose.Types.ObjectId();
const eventId = new mongoose.Types.ObjectId();

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

  await User.create([
    { _id: userId,  clerk_user_id: 'u1', email: 'alice@test.com', name: 'Alice', org_id: orgId, role: 'admin' },
    { _id: userId2, clerk_user_id: 'u2', email: 'bob@test.com',   name: 'Bob',   org_id: orgId, role: 'member' },
  ]);

  await Event.create({
    _id:         eventId,
    title:       'Port Closure — Mumbai',
    description: 'JNPT port closed due to industrial action.',
    location:    { lat: 18.95, lng: 72.83 },
    country:     'India',
    country_code:'IN',
    event_type:  'port_closure',
    severity:    'high',
    occurred_at: new Date(),
    sources:     [{ url: 'https://example.com', name: 'Reuters' }],
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await WarRoom.deleteMany({});
  await WarRoomMessage.deleteMany({});
  await WarRoomActionItem.deleteMany({});
  await Alert.deleteMany({});
  await Decision.deleteMany({});
  await MitigationSuggestion.deleteMany({});
});

// ──────────────────────────────────────────────
// Action Item CRUD
// ──────────────────────────────────────────────

describe('WarRoomActionItem — CRUD', () => {
  test('creates with default status=open', async () => {
    const room = await WarRoom.create({
      org_id: orgId, name: 'Action Test', created_by: userId, participants: [userId],
    });
    const item = await WarRoomActionItem.create({
      war_room_id: room._id,
      org_id: orgId,
      title:       'Notify freight forwarder',
      created_by:  userId,
    });
    expect(item.status).toBe('open');
    expect(item.assignee_user_id).toBeNull();
    expect(item.due_at).toBeNull();
  });

  test('status transitions: open → in_progress → done', async () => {
    const room = await WarRoom.create({
      org_id: orgId, name: 'Status Test', created_by: userId, participants: [userId],
    });
    const item = await WarRoomActionItem.create({
      war_room_id: room._id, org_id: orgId, title: 'Check manifests', created_by: userId,
    });
    await WarRoomActionItem.findByIdAndUpdate(item._id, { status: 'in_progress' }, { runValidators: true });
    const inProg = await WarRoomActionItem.findById(item._id).lean();
    expect(inProg?.status).toBe('in_progress');

    await WarRoomActionItem.findByIdAndUpdate(item._id, { status: 'done' }, { runValidators: true });
    const done = await WarRoomActionItem.findById(item._id).lean();
    expect(done?.status).toBe('done');
  });

  test('invalid status rejected by enum', async () => {
    const room = await WarRoom.create({
      org_id: orgId, name: 'Validation Test', created_by: userId, participants: [userId],
    });
    const item = await WarRoomActionItem.create({
      war_room_id: room._id, org_id: orgId, title: 'Task', created_by: userId,
    });
    await expect(
      WarRoomActionItem.findByIdAndUpdate(item._id, { status: 'cancelled' }, { runValidators: true, new: true }),
    ).rejects.toThrow();
  });

  test('assignee can be set and cleared', async () => {
    const room = await WarRoom.create({
      org_id: orgId, name: 'Assignee Test', created_by: userId, participants: [userId, userId2],
    });
    const item = await WarRoomActionItem.create({
      war_room_id: room._id, org_id: orgId, title: 'Call supplier', created_by: userId,
    });
    await WarRoomActionItem.findByIdAndUpdate(item._id, { assignee_user_id: userId2 });
    const assigned = await WarRoomActionItem.findById(item._id).lean();
    expect(String(assigned?.assignee_user_id)).toBe(String(userId2));

    await WarRoomActionItem.findByIdAndUpdate(item._id, { assignee_user_id: null });
    const cleared = await WarRoomActionItem.findById(item._id).lean();
    expect(cleared?.assignee_user_id).toBeNull();
  });

  test('org isolation: items from another org not visible', async () => {
    const otherOrg = new mongoose.Types.ObjectId();
    const room = await WarRoom.create({
      org_id: orgId, name: 'Isolated Room', created_by: userId, participants: [userId],
    });
    await WarRoomActionItem.create({
      war_room_id: room._id, org_id: orgId, title: 'Isolated Task', created_by: userId,
    });
    const results = await WarRoomActionItem.find({ war_room_id: room._id, org_id: otherOrg }).lean();
    expect(results).toHaveLength(0);
  });

  test('multiple items per room sorted by created_at', async () => {
    const room = await WarRoom.create({
      org_id: orgId, name: 'Multi-item Room', created_by: userId, participants: [userId],
    });
    await WarRoomActionItem.create({ war_room_id: room._id, org_id: orgId, title: 'First', created_by: userId });
    await WarRoomActionItem.create({ war_room_id: room._id, org_id: orgId, title: 'Second', created_by: userId });
    const items = await WarRoomActionItem.find({ war_room_id: room._id }).sort({ created_at: 1 }).lean();
    expect(items).toHaveLength(2);
    expect(items[0]?.title).toBe('First');
    expect(items[1]?.title).toBe('Second');
  });
});

// ──────────────────────────────────────────────
// Alert state-sync logic (unit)
// ──────────────────────────────────────────────

async function makeAlert(status: 'open' | 'triaged' | 'closed') {
  return Alert.create({
    org_id:   orgId,
    event_id: eventId,
    severity: 'high',
    subtype:  'physical_risk',
    status,
    match_reasons: ['country'],
    event_snapshot: {
      title:       'Test Event',
      description: 'Test',
      location:    { lat: 0, lng: 0 },
      country:     'India',
      country_code:'IN',
      event_type:  'port_closure',
      occurred_at: new Date(),
      sources:     [],
    },
    llm_context: { why_matters: null, recommended_actions: [] },
  });
}

describe('Alert state-sync logic', () => {
  test('open war room with open alert → alert transitions to triaged', async () => {
    const alert = await makeAlert('open');
    const room = await WarRoom.create({
      org_id: orgId, name: 'State Sync Open', alert_id: alert._id, created_by: userId, participants: [userId],
    });

    // Inline the sync logic from the worker
    const loadedRoom = await WarRoom.findById(room._id).lean();
    const loadedAlert = await Alert.findById(alert._id).lean();
    if (loadedRoom?.alert_id && loadedAlert?.status === 'open') {
      await Alert.updateOne({ _id: loadedAlert._id }, { status: 'triaged' });
    }

    const updated = await Alert.findById(alert._id).lean();
    expect(updated?.status).toBe('triaged');
  });

  test('closing war room → alert transitions to closed + system message posted', async () => {
    const alert = await makeAlert('triaged');
    const room = await WarRoom.create({
      org_id: orgId, name: 'State Sync Close', alert_id: alert._id, created_by: userId, participants: [userId],
    });

    // Inline sync logic for 'closed'
    const loadedAlert = await Alert.findById(alert._id).lean();
    if (loadedAlert && loadedAlert.status !== 'closed') {
      await Alert.updateOne({ _id: loadedAlert._id }, { status: 'closed' });
      await WarRoomMessage.create({
        war_room_id: room._id,
        user_id:     userId,
        body:        'Alert marked resolved. Consider closing this war room.',
        msg_type:    'system',
        attachments: [],
      });
    }

    const closed = await Alert.findById(alert._id).lean();
    expect(closed?.status).toBe('closed');

    const sysMsg = await WarRoomMessage.findOne({ war_room_id: room._id, msg_type: 'system' }).lean();
    expect(sysMsg?.body).toContain('Alert marked resolved');
  });

  test('no-op when alert already closed', async () => {
    const alert = await makeAlert('closed');
    // Sync logic: skip if already closed
    const before = await Alert.findById(alert._id).lean();
    if (before && before.status !== 'closed') {
      await Alert.updateOne({ _id: before._id }, { status: 'closed' });
    }
    const after = await Alert.findById(alert._id).lean();
    expect(after?.status).toBe('closed');
  });

  test('war room without alert_id is a no-op', async () => {
    const room = await WarRoom.create({
      org_id: orgId, name: 'No Alert Room', created_by: userId, participants: [userId],
    });
    const loaded = await WarRoom.findById(room._id).lean();
    // Worker returns early when alert_id is null
    expect(loaded?.alert_id).toBeNull();
  });
});

// ──────────────────────────────────────────────
// Mitigation accept/reject flow
// ──────────────────────────────────────────────

describe('Mitigation accept/reject flow', () => {
  test('creates with status=proposed', async () => {
    const alert = await makeAlert('open');
    const sug = await MitigationSuggestion.create({
      org_id:         orgId,
      alert_id:       alert._id,
      suggestion_type:'alt_route',
      narrative:      'Route via Colombo instead of JNPT.',
      confidence_pct: 75,
      estimated_var_reduction_usd: 250000,
    });
    expect(sug.status).toBe('proposed');
  });

  test('proposed → accepted via $set', async () => {
    const alert = await makeAlert('open');
    const sug = await MitigationSuggestion.create({
      org_id: orgId, alert_id: alert._id, suggestion_type: 'alt_supplier',
      narrative: 'Switch to Bangalore supplier.', confidence_pct: 60,
    });
    await MitigationSuggestion.findByIdAndUpdate(sug._id, { $set: { status: 'accepted' } });
    const accepted = await MitigationSuggestion.findById(sug._id).lean();
    expect(accepted?.status).toBe('accepted');
  });

  test('proposed → rejected via $set', async () => {
    const alert = await makeAlert('open');
    const sug = await MitigationSuggestion.create({
      org_id: orgId, alert_id: alert._id, suggestion_type: 'inventory_buffer',
      narrative: 'Hold 30-day buffer stock.', confidence_pct: 80,
    });
    await MitigationSuggestion.findByIdAndUpdate(sug._id, { $set: { status: 'rejected' } });
    const rejected = await MitigationSuggestion.findById(sug._id).lean();
    expect(rejected?.status).toBe('rejected');
  });

  test('multiple suggestions per alert filtered by status', async () => {
    const alert = await makeAlert('open');
    await MitigationSuggestion.create({
      org_id: orgId, alert_id: alert._id, suggestion_type: 'alt_route',
      narrative: 'Option A', confidence_pct: 70,
    });
    const sug2 = await MitigationSuggestion.create({
      org_id: orgId, alert_id: alert._id, suggestion_type: 'alt_supplier',
      narrative: 'Option B', confidence_pct: 55,
    });
    await MitigationSuggestion.findByIdAndUpdate(sug2._id, { $set: { status: 'accepted' } });

    const proposed = await MitigationSuggestion.find({ alert_id: alert._id, status: 'proposed' }).lean();
    const accepted = await MitigationSuggestion.find({ alert_id: alert._id, status: 'accepted' }).lean();
    expect(proposed).toHaveLength(1);
    expect(accepted).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────
// Transcript data assembly
// ──────────────────────────────────────────────

describe('Transcript data assembly', () => {
  test('fetches all messages, decisions, and action items for a room', async () => {
    const alert = await makeAlert('open');
    const room = await WarRoom.create({
      org_id: orgId, name: 'Transcript Room', alert_id: alert._id,
      created_by: userId, participants: [userId, userId2],
    });

    await WarRoomMessage.create([
      { war_room_id: room._id, user_id: userId,  body: 'Situation briefing.', msg_type: 'chat', attachments: [] },
      { war_room_id: room._id, user_id: userId2, body: 'Acknowledged.', msg_type: 'chat', attachments: [] },
      { war_room_id: room._id, user_id: userId,  body: 'Decision logged: route via Colombo', msg_type: 'system', attachments: [] },
    ]);

    await WarRoomActionItem.create([
      { war_room_id: room._id, org_id: orgId, title: 'Notify logistics team', created_by: userId },
      { war_room_id: room._id, org_id: orgId, title: 'File insurance claim', created_by: userId2, assignee_user_id: userId, status: 'in_progress' },
    ]);

    await Decision.create({
      org_id: orgId,
      alert_id:      alert._id,
      user_id:       userId,
      decision_type: 'acknowledged',
      decision_text: 'Route cargo via Colombo port.',
      justification: JSON.stringify({ text: 'Fastest alternative', claim_chain: [] }),
      made_at:       new Date(),
    });

    const messages  = await WarRoomMessage.find({ war_room_id: room._id }).sort({ created_at: 1 }).lean();
    const items     = await WarRoomActionItem.find({ war_room_id: room._id }).sort({ created_at: 1 }).lean();
    const decisions = await Decision.find({ org_id: orgId, alert_id: alert._id }).sort({ made_at: 1 }).lean();

    expect(messages).toHaveLength(3);
    expect(items).toHaveLength(2);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.decision_text).toBe('Route cargo via Colombo port.');
    const inProgItem = items.find(i => i.title === 'File insurance claim');
    expect(inProgItem?.status).toBe('in_progress');
    expect(messages.map(m => m.msg_type)).toEqual(['chat', 'chat', 'system']);
  });

  test('QuickPoll — stored with msg_type=poll and vote aggregation', async () => {
    const room = await WarRoom.create({
      org_id: orgId, name: 'Poll Room', created_by: userId, participants: [userId, userId2],
    });
    const pollMsg = await WarRoomMessage.create({
      war_room_id: room._id,
      user_id:     userId,
      body:        'Should we halt shipments?',
      msg_type:    'poll',
      attachments: [],
      poll: { question: 'Should we halt shipments?', votes: [] },
    });
    expect(pollMsg.msg_type).toBe('poll');
    expect(pollMsg.poll?.question).toBe('Should we halt shipments?');
    expect(pollMsg.poll?.votes).toHaveLength(0);

    await WarRoomMessage.findByIdAndUpdate(pollMsg._id, {
      $push: { 'poll.votes': { user_id: userId, vote: 'yes' } },
    });
    await WarRoomMessage.findByIdAndUpdate(pollMsg._id, {
      $push: { 'poll.votes': { user_id: userId2, vote: 'no' } },
    });

    const updated = await WarRoomMessage.findById(pollMsg._id).lean();
    expect(updated?.poll?.votes).toHaveLength(2);
    expect(updated?.poll?.votes.filter(v => v.vote === 'yes')).toHaveLength(1);
    expect(updated?.poll?.votes.filter(v => v.vote === 'no')).toHaveLength(1);
  });
});

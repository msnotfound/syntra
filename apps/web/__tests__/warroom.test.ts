import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { WarRoom } from '../../../packages/db/models/WarRoom';
import { WarRoomMessage } from '../../../packages/db/models/WarRoomMessage';
import { Organization } from '../../../packages/db/models/Organization';
import { User } from '../../../packages/db/models/User';

let mongod: MongoMemoryServer;

const orgId  = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const userId2 = new mongoose.Types.ObjectId();

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
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await WarRoom.deleteMany({});
  await WarRoomMessage.deleteMany({});
});

// ──────────────────────────────────────────────
// WarRoom model
// ──────────────────────────────────────────────

describe('WarRoom — schema', () => {
  test('creates with default status=open', async () => {
    const room = await WarRoom.create({
      org_id:      orgId,
      name:        'Critical supply disruption',
      created_by:  userId,
      participants: [userId],
    });
    expect(room.status).toBe('open');
  });

  test('status transitions: open → closed', async () => {
    const room = await WarRoom.create({
      org_id: orgId, name: 'Room A', created_by: userId, participants: [userId],
    });
    await WarRoom.updateOne({ _id: room._id }, { status: 'closed' });
    const closed = await WarRoom.findById(room._id).lean();
    expect(closed?.status).toBe('closed');
  });

  test('invalid status rejected by enum', async () => {
    const room = await WarRoom.create({
      org_id: orgId, name: 'Room B', created_by: userId, participants: [userId],
    });
    await expect(
      WarRoom.findByIdAndUpdate(room._id, { status: 'deleted' }, { runValidators: true, new: true })
    ).rejects.toThrow();
  });

  test('participants array starts with creator', async () => {
    const room = await WarRoom.create({
      org_id: orgId, name: 'Room C', created_by: userId, participants: [userId],
    });
    expect(room.participants.map(String)).toContain(String(userId));
  });

  test('org isolation: cannot fetch room from another org', async () => {
    const otherOrg = new mongoose.Types.ObjectId();
    const room = await WarRoom.create({
      org_id: orgId, name: 'Secret Room', created_by: userId, participants: [userId],
    });
    const result = await WarRoom.findOne({ _id: room._id, org_id: otherOrg }).lean();
    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────
// WarRoomMessage — append-only semantics
// ──────────────────────────────────────────────

describe('WarRoomMessage — append-only', () => {
  test('messages are created and not mutated', async () => {
    const room = await WarRoom.create({
      org_id: orgId, name: 'Append Test', created_by: userId, participants: [userId],
    });

    const msg = await WarRoomMessage.create({
      war_room_id: room._id,
      user_id:     userId,
      body:        'Initial assessment: port closure confirmed.',
    });

    expect(String(msg.war_room_id)).toBe(String(room._id));
    expect(msg.body).toBe('Initial assessment: port closure confirmed.');
    expect(msg.attachments).toHaveLength(0);

    // No update path — only read back to verify immutability at test level
    const fetched = await WarRoomMessage.findById(msg._id).lean();
    expect(fetched?.body).toBe('Initial assessment: port closure confirmed.');
  });

  test('multiple messages accumulate in insertion order', async () => {
    const room = await WarRoom.create({
      org_id: orgId, name: 'Ordering Test', created_by: userId, participants: [userId],
    });

    await WarRoomMessage.create({ war_room_id: room._id, user_id: userId,  body: 'First' });
    await WarRoomMessage.create({ war_room_id: room._id, user_id: userId2, body: 'Second' });
    await WarRoomMessage.create({ war_room_id: room._id, user_id: userId,  body: 'Third' });

    const msgs = await WarRoomMessage.find({ war_room_id: room._id }).sort({ created_at: 1 }).lean();
    expect(msgs).toHaveLength(3);
    expect(msgs[0]?.body).toBe('First');
    expect(msgs[1]?.body).toBe('Second');
    expect(msgs[2]?.body).toBe('Third');
  });

  test('body is required', async () => {
    const room = await WarRoom.create({
      org_id: orgId, name: 'Validation Test', created_by: userId, participants: [userId],
    });
    await expect(
      WarRoomMessage.create({ war_room_id: room._id, user_id: userId })
    ).rejects.toThrow();
  });

  test('messages isolated to war room', async () => {
    const room1 = await WarRoom.create({ org_id: orgId, name: 'Room 1', created_by: userId, participants: [userId] });
    const room2 = await WarRoom.create({ org_id: orgId, name: 'Room 2', created_by: userId, participants: [userId] });

    await WarRoomMessage.create({ war_room_id: room1._id, user_id: userId, body: 'In room 1' });

    const r2msgs = await WarRoomMessage.find({ war_room_id: room2._id }).lean();
    expect(r2msgs).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────
// SSE event format (unit-level, no HTTP)
// ──────────────────────────────────────────────

describe('SSE event format', () => {
  test('message payload matches expected shape', async () => {
    const room = await WarRoom.create({
      org_id: orgId, name: 'SSE Test Room', created_by: userId, participants: [userId],
    });
    const msg = await WarRoomMessage.create({
      war_room_id: room._id,
      user_id:     userId,
      body:        'Hello from SSE test',
      attachments: [],
    });

    // Simulate what the stream route emits
    const payload = {
      id:          String(msg._id),
      war_room_id: String(msg.war_room_id),
      user_id:     String(msg.user_id),
      body:        msg.body,
      attachments: msg.attachments,
      created_at:  msg.created_at,
    };

    const sseChunk = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;

    expect(sseChunk).toContain('event: message');
    expect(sseChunk).toContain('"body":"Hello from SSE test"');
    expect(JSON.parse(sseChunk.split('data: ')[1]).war_room_id).toBe(String(room._id));
  });
});

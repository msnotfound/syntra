import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AssistantThread } from '../../../packages/db/models/AssistantThread';
import { Organization } from '../../../packages/db/models/Organization';
import { User } from '../../../packages/db/models/User';
import { UsageEvent } from '../../../packages/db/models/UsageEvent';
import { extractClaimIds, checkUserRateLimit } from '../lib/assistant/utils';

let mongod: MongoMemoryServer;

const orgId  = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  await Organization.create({
    _id: orgId,
    name: 'Test Pharma',
    slug: 'test-pharma',
    plan: 'growth',
    status: 'active',
    trial_ends_at: new Date(Date.now() + 86400000),
    contact_email: 'admin@testpharma.com',
    settings: {
      alert_channels: ['email'],
      webhook_url: null,
      severity_threshold: 'low',
      quiet_hours_start: null,
      quiet_hours_end: null,
      timezone: 'Asia/Kolkata',
      assistant_token_budget_monthly: 200_000,
    },
    demo_mode: false,
  });

  await User.create({
    _id: userId,
    clerk_user_id: 'u_test_assistant',
    email: 'user@testpharma.com',
    name: 'Test User',
    org_id: orgId,
    role: 'admin',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await AssistantThread.deleteMany({});
  await UsageEvent.deleteMany({});
});

// ──────────────────────────────────────────────────────────
// AssistantThread — schema & persistence
// ──────────────────────────────────────────────────────────

describe('AssistantThread — schema', () => {
  test('creates thread with default empty turns', async () => {
    const thread = await AssistantThread.create({
      org_id:          orgId,
      user_id:         'u_test_assistant',
      conversation_id: 'conv_001',
      context_page:    '/app/test-pharma/alerts',
      context_entity_ids: [],
    });
    expect(thread.turns).toHaveLength(0);
    expect(thread.context_page).toBe('/app/test-pharma/alerts');
  });

  test('appends user and assistant turns', async () => {
    const thread = await AssistantThread.findOneAndUpdate(
      { org_id: orgId, conversation_id: 'conv_002' },
      {
        $set:  { user_id: 'u_test_assistant', context_page: null, context_entity_ids: [] },
        $push: {
          turns: {
            $each: [
              { role: 'user',      text: 'What is our exposure to Red Sea risk?', cited_claim_ids: [], created_at: new Date() },
              { role: 'assistant', text: 'Your exposure is moderate. [claim:abc123]', cited_claim_ids: ['abc123'], created_at: new Date() },
            ],
          },
        },
      },
      { upsert: true, new: true },
    );
    expect(thread!.turns).toHaveLength(2);
    expect(thread!.turns[1].cited_claim_ids).toContain('abc123');
  });

  test('unique index enforced on (org_id, conversation_id)', async () => {
    await AssistantThread.create({
      org_id: orgId, user_id: 'u_test_assistant', conversation_id: 'conv_dup',
      context_page: null, context_entity_ids: [],
    });
    await expect(
      AssistantThread.create({
        org_id: orgId, user_id: 'u_test_assistant', conversation_id: 'conv_dup',
        context_page: null, context_entity_ids: [],
      }),
    ).rejects.toThrow();
  });

  test('different org can use the same conversation_id', async () => {
    const org2 = new mongoose.Types.ObjectId();
    await AssistantThread.create({
      org_id: orgId,  user_id: 'u1', conversation_id: 'conv_shared',
      context_page: null, context_entity_ids: [],
    });
    const t2 = await AssistantThread.create({
      org_id: org2,  user_id: 'u2', conversation_id: 'conv_shared',
      context_page: null, context_entity_ids: [],
    });
    expect(String(t2.org_id)).toBe(String(org2));
  });

  test('querying by org_id scopes correctly', async () => {
    const otherOrg = new mongoose.Types.ObjectId();
    await AssistantThread.create([
      { org_id: orgId,    user_id: 'u1', conversation_id: 'conv_a', context_page: null, context_entity_ids: [] },
      { org_id: otherOrg, user_id: 'u2', conversation_id: 'conv_b', context_page: null, context_entity_ids: [] },
    ]);
    const mine = await AssistantThread.find({ org_id: orgId }).lean();
    expect(mine).toHaveLength(1);
    expect(mine[0].conversation_id).toBe('conv_a');
  });
});

// ──────────────────────────────────────────────────────────
// extractClaimIds — citation parser
// ──────────────────────────────────────────────────────────

describe('extractClaimIds', () => {
  test('extracts single claim', () => {
    expect(extractClaimIds('Disruption noted [claim:abc123].')).toEqual(['abc123']);
  });

  test('extracts multiple unique claims', () => {
    const ids = extractClaimIds('[claim:aaa] and [claim:bbb] context [claim:aaa] again');
    expect(ids).toEqual(['aaa', 'bbb']);
  });

  test('returns empty array when no claims present', () => {
    expect(extractClaimIds('No citations here.')).toEqual([]);
  });

  test('handles hex ObjectId-style claim IDs', () => {
    const ids = extractClaimIds('Based on data [claim:64a1b2c3d4e5f6a7b8c9d0e1].');
    expect(ids).toEqual(['64a1b2c3d4e5f6a7b8c9d0e1']);
  });

  test('handles claim IDs with hyphens and underscores', () => {
    const ids = extractClaimIds('[claim:claim_001] [claim:claim-002]');
    expect(ids).toEqual(['claim_001', 'claim-002']);
  });
});

// ──────────────────────────────────────────────────────────
// checkUserRateLimit — in-memory per-user gate
// ──────────────────────────────────────────────────────────

describe('checkUserRateLimit', () => {
  test('allows first request', () => {
    expect(checkUserRateLimit('rl_user_fresh_' + Date.now())).toBe(true);
  });

  test('blocks after 60 requests in the same window', () => {
    const uid = 'rl_user_heavy_' + Date.now();
    for (let i = 0; i < 60; i++) checkUserRateLimit(uid);
    expect(checkUserRateLimit(uid)).toBe(false);
  });

  test('different users have independent windows', () => {
    const u1 = 'rl_u1_' + Date.now();
    const u2 = 'rl_u2_' + Date.now();
    for (let i = 0; i < 60; i++) checkUserRateLimit(u1);
    expect(checkUserRateLimit(u1)).toBe(false);
    expect(checkUserRateLimit(u2)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────
// UsageEvent — assistant_query tracking
// ──────────────────────────────────────────────────────────

describe('UsageEvent — assistant_query type', () => {
  test('creates assistant_query event with token metadata', async () => {
    const ev = await UsageEvent.create({
      org_id:   orgId,
      type:     'assistant_query',
      metadata: { conversation_id: 'conv_ue1', tokens_used: 512, user_id: 'u_test_assistant' },
    });
    expect(ev.type).toBe('assistant_query');
    expect(ev.metadata.tokens_used).toBe(512);
  });

  test('aggregates monthly token spend', async () => {
    await UsageEvent.create([
      { org_id: orgId, type: 'assistant_query', metadata: { tokens_used: 1000 } },
      { org_id: orgId, type: 'assistant_query', metadata: { tokens_used: 2000 } },
      { org_id: orgId, type: 'api_call',        metadata: { tokens_used: 9999 } }, // different type
    ]);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const result = await UsageEvent.aggregate<{ total: number }>([
      { $match: { org_id: orgId, type: 'assistant_query', created_at: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$metadata.tokens_used' } } },
    ]);

    expect(result[0]?.total).toBe(3000);
  });
});

// ──────────────────────────────────────────────────────────
// Organization — assistant_token_budget_monthly field
// ──────────────────────────────────────────────────────────

describe('Organization — assistant_token_budget_monthly', () => {
  test('reads budget from org settings', async () => {
    const org = await Organization.findById(orgId).lean();
    expect(org?.settings.assistant_token_budget_monthly).toBe(200_000);
  });

  test('defaults to 200_000 when not set explicitly', async () => {
    const newOrg = await Organization.create({
      name: 'Budget Default Org',
      slug: 'budget-default-org',
      plan: 'trial',
      status: 'active',
      trial_ends_at: new Date(Date.now() + 86400000),
      contact_email: 'b@b.com',
      settings: {
        alert_channels: ['email'],
        webhook_url: null,
        severity_threshold: 'low',
        quiet_hours_start: null,
        quiet_hours_end: null,
        timezone: 'UTC',
      },
    });
    expect(newOrg.settings.assistant_token_budget_monthly).toBe(200_000);
  });
});

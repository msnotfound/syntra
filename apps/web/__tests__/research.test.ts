import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { randomUUID as uuidv4 } from 'crypto';
import { ResearchSession } from '../../../packages/db/models/ResearchSession';
import { ResearchReport } from '../../../packages/db/models/ResearchReport';
import { IntelClaim } from '../../../packages/db/models/IntelClaim';
import { SourceReliability } from '../../../packages/db/models/SourceReliability';
import { Organization } from '../../../packages/db/models/Organization';
import { User } from '../../../packages/db/models/User';

let mongod: MongoMemoryServer;

const orgId = new mongoose.Types.ObjectId();
const otherOrgId = new mongoose.Types.ObjectId();
const userId = 'user_research_test_123';

function makeStep(overrides: Partial<{
  step_id: string;
  order: number;
  kind: string;
  title: string;
  status: string;
}> = {}) {
  return {
    step_id: overrides.step_id ?? uuidv4(),
    order: overrides.order ?? 0,
    kind: overrides.kind ?? 'sub_question',
    title: overrides.title ?? 'Break question into sub-questions',
    description: null,
    status: overrides.status ?? 'proposed',
    prompt: null,
    output: null,
    evidence_claim_ids: [],
  };
}

function makeSessionData(overrides: Record<string, unknown> = {}) {
  return {
    org_id: orgId,
    user_id: userId,
    question: 'Impact of Red Sea closure on Indian generics export to EU',
    status: 'planning',
    plan_steps: [makeStep()],
    final_report_id: null,
    ...overrides,
  };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  await Organization.create([
    {
      _id: orgId,
      name: 'Test Pharma Corp',
      slug: 'test-pharma-corp',
      plan: 'growth',
      status: 'active',
      trial_ends_at: new Date(Date.now() + 86400000),
      contact_email: 'ops@testpharma.com',
      settings: {
        alert_channels: ['email'],
        webhook_url: null,
        severity_threshold: 'low',
        quiet_hours_start: null,
        quiet_hours_end: null,
        timezone: 'Asia/Kolkata',
      },
      demo_mode: false,
    },
    {
      _id: otherOrgId,
      name: 'Other Corp',
      slug: 'other-corp',
      plan: 'starter',
      status: 'active',
      trial_ends_at: new Date(Date.now() + 86400000),
      contact_email: 'ops@othercorp.com',
      settings: {
        alert_channels: ['email'],
        webhook_url: null,
        severity_threshold: 'low',
        quiet_hours_start: null,
        quiet_hours_end: null,
        timezone: 'UTC',
      },
      demo_mode: false,
    },
  ]);

  await User.create({
    clerk_user_id: userId,
    email: 'analyst@testpharma.com',
    name: 'Test Analyst',
    org_id: orgId,
    role: 'member',
  });

  await SourceReliability.create({
    source_id: 'research-session',
    source_name: 'Syntra Research Session',
    admiralty_code: 'B',
    reliability_pct: 75,
    last_assessed_at: new Date(),
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await ResearchSession.deleteMany({});
  await ResearchReport.deleteMany({});
  await IntelClaim.deleteMany({});
});

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

describe('ResearchSession — creation', () => {
  test('creates session with sub_question step in proposed status', async () => {
    const session = await ResearchSession.create(makeSessionData());
    expect(session).toBeDefined();
    expect(session.status).toBe('planning');
    expect(session.plan_steps).toHaveLength(1);
    expect(session.plan_steps[0]!.kind).toBe('sub_question');
    expect(session.plan_steps[0]!.status).toBe('proposed');
    expect(session.plan_steps[0]!.step_id).toBeTruthy();
  });

  test('created_at and updated_at are auto-populated', async () => {
    const session = await ResearchSession.create(makeSessionData());
    expect(session.created_at).toBeInstanceOf(Date);
    expect(session.updated_at).toBeInstanceOf(Date);
  });

  test('final_report_id defaults to null', async () => {
    const session = await ResearchSession.create(makeSessionData());
    expect(session.final_report_id).toBeNull();
  });

  test('each plan_step gets a unique step_id', async () => {
    const session = await ResearchSession.create(makeSessionData({
      plan_steps: [
        makeStep({ kind: 'sub_question', order: 0 }),
        makeStep({ kind: 'synthesize', order: 1 }),
      ],
    }));
    const ids = session.plan_steps.map(s => s.step_id);
    expect(new Set(ids).size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Step transitions
// ---------------------------------------------------------------------------

describe('ResearchSession — step transitions', () => {
  test('edit transition: proposed → edited', async () => {
    const session = await ResearchSession.create(makeSessionData());
    const stepId = session.plan_steps[0]!.step_id;

    await ResearchSession.updateOne(
      { _id: session._id },
      {
        $set: {
          'plan_steps.$[step].status': 'edited',
          'plan_steps.$[step].title': 'Updated title',
        },
      },
      { arrayFilters: [{ 'step.step_id': stepId }] },
    );

    const updated = await ResearchSession.findById(session._id).lean();
    const step = updated!.plan_steps[0]!;
    expect(step.status).toBe('edited');
    expect(step.title).toBe('Updated title');
  });

  test('skip transition: proposed → skipped', async () => {
    const session = await ResearchSession.create(makeSessionData({
      plan_steps: [
        makeStep({ kind: 'sub_question', order: 0, status: 'done' }),
        makeStep({ kind: 'synthesize', order: 1, status: 'proposed' }),
      ],
    }));
    const stepId = session.plan_steps[1]!.step_id;

    await ResearchSession.updateOne(
      { _id: session._id },
      { $set: { 'plan_steps.$[step].status': 'skipped' } },
      { arrayFilters: [{ 'step.step_id': stepId }] },
    );

    const updated = await ResearchSession.findById(session._id).lean();
    expect(updated!.plan_steps[1]!.status).toBe('skipped');
    expect(updated!.plan_steps[0]!.status).toBe('done');
  });

  test('run transition: proposed → running → done', async () => {
    const session = await ResearchSession.create(makeSessionData());
    const stepId = session.plan_steps[0]!.step_id;

    await ResearchSession.updateOne(
      { _id: session._id },
      { $set: { 'plan_steps.$[step].status': 'running' } },
      { arrayFilters: [{ 'step.step_id': stepId }] },
    );

    await ResearchSession.updateOne(
      { _id: session._id },
      {
        $set: {
          'plan_steps.$[step].status': 'done',
          'plan_steps.$[step].output': { kind: 'text', payload: 'result data' },
        },
      },
      { arrayFilters: [{ 'step.step_id': stepId }] },
    );

    const updated = await ResearchSession.findById(session._id).lean();
    expect(updated!.plan_steps[0]!.status).toBe('done');
    expect(updated!.plan_steps[0]!.output).toMatchObject({ kind: 'text', payload: 'result data' });
  });

  test('accept transition: proposed → accepted persisted', async () => {
    const session = await ResearchSession.create(makeSessionData());
    const stepId = session.plan_steps[0]!.step_id;

    await ResearchSession.updateOne(
      { _id: session._id },
      { $set: { 'plan_steps.$[step].status': 'accepted' } },
      { arrayFilters: [{ 'step.step_id': stepId }] },
    );

    const updated = await ResearchSession.findById(session._id).lean();
    expect(updated!.plan_steps[0]!.status).toBe('accepted');
  });
});

// ---------------------------------------------------------------------------
// Finalize → ResearchReport + IntelClaims
// ---------------------------------------------------------------------------

describe('ResearchSession — finalize produces report with IntelClaims', () => {
  test('finalize creates ResearchReport with exec_summary populated', async () => {
    const sourceDoc = await SourceReliability.findOne({ source_id: 'research-session' });
    const claimId1 = (await IntelClaim.create({
      source_id: sourceDoc!._id,
      claim_text: 'Red Sea closure has rerouted 15% of global container traffic via Cape of Good Hope.',
      evidence_url: 'https://lloydslist.com/example',
      asserted_at: new Date(),
      parent_claim_ids: [],
      claim_type: 'fact',
      alert_id: null,
    }))._id;
    const claimId2 = (await IntelClaim.create({
      source_id: sourceDoc!._id,
      claim_text: 'Indian pharma exports to EU face 10-14 day additional transit time.',
      evidence_url: null,
      asserted_at: new Date(),
      parent_claim_ids: [claimId1],
      claim_type: 'inference',
      alert_id: null,
    }))._id;

    const stepId = uuidv4();
    const session = await ResearchSession.create({
      org_id: orgId,
      user_id: userId,
      question: 'Impact of Red Sea closure on Indian generics',
      status: 'drafting',
      plan_steps: [
        {
          step_id: uuidv4(),
          order: 0,
          kind: 'sub_question',
          title: 'Plan',
          description: null,
          status: 'done',
          prompt: null,
          output: { kind: 'text', payload: 'done' },
          evidence_claim_ids: [],
        },
        {
          step_id: stepId,
          order: 1,
          kind: 'synthesize',
          title: 'Assess route disruption',
          description: null,
          status: 'done',
          prompt: 'Assess route disruption',
          output: {
            kind: 'text',
            payload: {
              heading: 'Route Disruption Assessment',
              markdown: `Red Sea closure affects key shipping lanes. [claim:${String(claimId1)}] Transit times increased significantly. [claim:${String(claimId2)}]`,
              cited_claim_ids: [String(claimId1), String(claimId2)],
            },
          },
          evidence_claim_ids: [String(claimId1), String(claimId2)],
        },
        {
          step_id: uuidv4(),
          order: 2,
          kind: 'recommend_actions',
          title: 'Recommendations',
          description: null,
          status: 'done',
          prompt: null,
          output: {
            kind: 'text',
            payload: {
              actions: [
                { text: 'Reroute via Cape of Good Hope', rationale: 'Lower risk.', cited_claim_ids: [String(claimId1)] },
              ],
            },
          },
          evidence_claim_ids: [String(claimId1)],
        },
      ],
      final_report_id: null,
    });

    const report = await ResearchReport.create({
      org_id: orgId,
      research_session_id: session._id,
      exec_summary: 'Red Sea closure significantly impacts Indian pharma exports to the EU, adding 10-14 days transit time and requiring Cape of Good Hope rerouting.',
      sections: [{
        heading: 'Route Disruption Assessment',
        markdown: `Red Sea closure affects key shipping lanes. [claim:${String(claimId1)}]`,
        cited_claim_ids: [String(claimId1)],
      }],
      claim_graph: {
        nodes: [
          { id: String(claimId1), label: 'Red Sea closure fact', kind: 'fact' },
          { id: String(claimId2), label: 'Pharma transit inference', kind: 'inference' },
        ],
        edges: [{ from: String(claimId1), to: String(claimId2), label: 'supports' }],
      },
      recommended_actions: [{
        text: 'Reroute via Cape of Good Hope',
        rationale: 'Lower risk.',
        cited_claim_ids: [String(claimId1)],
      }],
      risk_brief_id: null,
    });

    await ResearchSession.updateOne(
      { _id: session._id },
      { $set: { status: 'finalized', final_report_id: report._id } },
    );

    const finalSession = await ResearchSession.findById(session._id).lean();
    expect(finalSession!.status).toBe('finalized');
    expect(String(finalSession!.final_report_id)).toBe(String(report._id));

    expect(report.exec_summary.length).toBeGreaterThan(10);
    expect(report.sections).toHaveLength(1);
    expect(report.sections[0]!.cited_claim_ids).toContain(String(claimId1));
    expect(report.recommended_actions).toHaveLength(1);

    const claimCount = await IntelClaim.countDocuments();
    expect(claimCount).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Org scoping
// ---------------------------------------------------------------------------

describe('ResearchSession — org scoping', () => {
  test('cannot read another org session by id', async () => {
    const session = await ResearchSession.create(makeSessionData({ org_id: otherOrgId }));
    const result = await ResearchSession.findOne({ _id: session._id, org_id: orgId }).lean();
    expect(result).toBeNull();
  });

  test('list query scoped to org', async () => {
    await ResearchSession.create(makeSessionData({ org_id: orgId }));
    await ResearchSession.create(makeSessionData({ org_id: otherOrgId }));

    const results = await ResearchSession.find({ org_id: orgId }).lean();
    expect(results).toHaveLength(1);
    expect(String(results[0]!.org_id)).toBe(String(orgId));
  });

  test('ResearchReport scoped to org', async () => {
    const session = await ResearchSession.create(makeSessionData({ org_id: otherOrgId }));
    await ResearchReport.create({
      org_id: otherOrgId,
      research_session_id: session._id,
      exec_summary: 'Other org summary.',
      sections: [],
      claim_graph: { nodes: [], edges: [] },
      recommended_actions: [],
      risk_brief_id: null,
    });

    const result = await ResearchReport.findOne({ research_session_id: session._id, org_id: orgId }).lean();
    expect(result).toBeNull();
  });

  test('research_session_id index is unique per org', async () => {
    const session = await ResearchSession.create(makeSessionData());
    await ResearchReport.create({
      org_id: orgId,
      research_session_id: session._id,
      exec_summary: 'First report.',
      sections: [],
      claim_graph: { nodes: [], edges: [] },
      recommended_actions: [],
      risk_brief_id: null,
    });

    await expect(ResearchReport.create({
      org_id: orgId,
      research_session_id: session._id,
      exec_summary: 'Duplicate report.',
      sections: [],
      claim_graph: { nodes: [], edges: [] },
      recommended_actions: [],
      risk_brief_id: null,
    })).rejects.toThrow();
  });
});

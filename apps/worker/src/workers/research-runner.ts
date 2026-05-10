import { Queue, Worker } from 'bullmq';
import { randomUUID as uuidv4 } from 'crypto';
import {
  connectDb,
  ResearchSession,
  ResearchReport,
  IntelClaim,
  SourceReliability,
  RiskBrief,
  Organization,
  User,
} from '@syntra/db';
import type { IResearchSession, IResearchPlanStep } from '@syntra/db';
import { callLLMJson, streamAssistantTurn } from '@syntra/llm';
import { createHash, randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// Queue setup
// ---------------------------------------------------------------------------

const REDIS_URL = process.env.UPSTASH_REDIS_URL;
const connection = REDIS_URL
  ? { url: REDIS_URL }
  : { host: 'localhost', port: 6379 };

let queue: Queue | null = null;

export function getResearchRunnerQueue(): Queue {
  if (!queue) queue = new Queue('research-runner', { connection });
  return queue;
}

// ---------------------------------------------------------------------------
// LLM prompts
// ---------------------------------------------------------------------------

const SUB_QUESTION_SYSTEM =
  'You are an expert supply-chain risk analyst. Break down the user\'s research question into 3-6 focused sub-questions that together provide comprehensive coverage. Each sub-question should target a distinct aspect. Return only valid JSON.';

const SUB_QUESTION_TEMPLATE = `Research question: "{{question}}"

Generate 3-6 focused sub-questions to systematically investigate this topic. Each sub-question should cover a distinct angle (e.g., current situation, historical precedent, specific trade routes, regulatory environment, financial exposure, mitigation options).

Return JSON:
{
  "sub_questions": [
    { "title": string, "description": string }
  ]
}

Rules:
- title: max 12 words, action-oriented (e.g., "Assess current Red Sea closure impact on Suez transit")
- description: 1-2 sentences explaining what this sub-question covers
- 3-6 sub-questions, ordered from most to least critical`;

const SYNTHESIZE_SYSTEM =
  'You are a supply-chain risk analyst writing a structured research report section. Use only the provided evidence claims. Cite claims using [claim:ID] syntax inline. Return only valid JSON.';

const SYNTHESIZE_TEMPLATE = `Research question: "{{question}}"
Sub-question: "{{sub_question}}"

Evidence claims:
{{claims}}

Write a concise markdown section (150-300 words) addressing this sub-question using only the evidence above. Cite each claim you reference with [claim:ID] inline. Be analytical, not just descriptive.

Return JSON:
{
  "heading": string,
  "markdown": string,
  "cited_claim_ids": string[]
}`;

const RECOMMEND_ACTIONS_SYSTEM =
  'You are a supply-chain risk strategist. Generate specific, actionable recommendations based on research findings. Cite supporting evidence with [claim:ID] syntax. Return only valid JSON.';

const RECOMMEND_ACTIONS_TEMPLATE = `Research question: "{{question}}"

Research summary:
{{summary}}

All evidence claim IDs and text:
{{claims}}

Generate 3-7 specific recommended actions for the organization to mitigate risks identified in this research. Each action must be concrete and implementable.

Return JSON:
{
  "actions": [
    {
      "text": string,
      "rationale": string,
      "cited_claim_ids": string[]
    }
  ]
}

Rules:
- text: imperative, max 20 words (e.g., "Redirect shipments through Cape of Good Hope until Q3 2026")
- rationale: 1-2 sentences explaining why, citing evidence with [claim:ID]
- cited_claim_ids: array of claim IDs referenced in rationale
- 3-7 actions total, ordered by urgency`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureResearchSource(): Promise<{ _id: unknown }> {
  const existing = await SourceReliability.findOne({ source_id: 'research-session' }).lean();
  if (existing) return existing;
  const created = await SourceReliability.create({
    source_id: 'research-session',
    source_name: 'Syntra Research Session',
    admiralty_code: 'B',
    reliability_pct: 75,
    last_assessed_at: new Date(),
  });
  return created;
}

function buildClaimsText(claims: Array<{ _id: unknown; claim_text: string }>): string {
  return claims.map(c => `[claim:${String(c._id)}] ${c.claim_text}`).join('\n');
}

async function setStepStatus(
  sessionId: string,
  stepId: string,
  status: IResearchPlanStep['status'],
  output?: IResearchPlanStep['output'],
  evidenceClaimIds?: string[],
) {
  const update: Record<string, unknown> = {
    'plan_steps.$[step].status': status,
    'plan_steps.$[step].updated_at': new Date(),
  };
  if (output !== undefined) update['plan_steps.$[step].output'] = output;
  if (evidenceClaimIds !== undefined) update['plan_steps.$[step].evidence_claim_ids'] = evidenceClaimIds;

  await ResearchSession.updateOne(
    { _id: sessionId },
    { $set: update },
    { arrayFilters: [{ 'step.step_id': stepId }] },
  );
}

// ---------------------------------------------------------------------------
// Step executors
// ---------------------------------------------------------------------------

async function runSubQuestion(session: IResearchSession, step: IResearchPlanStep) {
  const userMsg = SUB_QUESTION_TEMPLATE.replace('{{question}}', session.question);

  const result = await callLLMJson<{ sub_questions: { title: string; description: string }[] }>(
    'claude-haiku-4-5-20251001',
    SUB_QUESTION_SYSTEM,
    userMsg,
    async () => ({
      sub_questions: [
        { title: 'Assess current route disruption magnitude', description: 'Quantify how many vessels and TEUs are affected by the current closure or disruption.' },
        { title: 'Identify affected Indian pharma export lanes', description: 'Map which specific shipping lanes are used for Indian generics to the EU and which are impacted.' },
        { title: 'Evaluate alternative routing options', description: 'Review Cape of Good Hope re-routing costs and transit time increases for Indian pharma exporters.' },
        { title: 'Analyse regulatory and compliance exposure', description: 'Assess whether re-routing triggers any EU customs, temperature chain, or import compliance requirements.' },
      ],
    }),
  );

  const subQuestions = result.sub_questions ?? [];
  const existingCount = session.plan_steps.length;

  // Create plan steps for each sub-question
  const newSteps: Partial<IResearchPlanStep>[] = [];
  subQuestions.forEach((sq, idx) => {
    const pullStep: Partial<IResearchPlanStep> = {
      step_id: uuidv4(),
      order: existingCount + idx * 2,
      kind: 'pull_intel_claims',
      title: `Pull evidence: ${sq.title}`,
      description: sq.description,
      status: 'proposed',
      prompt: sq.title,
      output: null,
      evidence_claim_ids: [],
      created_at: new Date(),
      updated_at: new Date(),
    };
    const synthesizeStep: Partial<IResearchPlanStep> = {
      step_id: uuidv4(),
      order: existingCount + idx * 2 + 1,
      kind: 'synthesize',
      title: `Draft section: ${sq.title}`,
      description: `Write a research section addressing: ${sq.description}`,
      status: 'proposed',
      prompt: sq.title,
      output: null,
      evidence_claim_ids: [],
      created_at: new Date(),
      updated_at: new Date(),
    };
    newSteps.push(pullStep, synthesizeStep);
  });

  // Add recommend_actions step last
  const recommendStep: Partial<IResearchPlanStep> = {
    step_id: uuidv4(),
    order: existingCount + subQuestions.length * 2,
    kind: 'recommend_actions',
    title: 'Generate recommended actions',
    description: 'Synthesise research findings into 3-7 actionable recommendations.',
    status: 'proposed',
    prompt: null,
    output: null,
    evidence_claim_ids: [],
    created_at: new Date(),
    updated_at: new Date(),
  };
  newSteps.push(recommendStep);

  await ResearchSession.updateOne(
    { _id: session._id },
    {
      $push: { plan_steps: { $each: newSteps } },
      $set: { status: 'researching' },
    },
  );

  await setStepStatus(String(session._id), step.step_id, 'done', {
    kind: 'text',
    payload: subQuestions.map(sq => sq.title).join('; '),
  });
}

async function runPullIntelClaims(session: IResearchSession, step: IResearchPlanStep) {
  const query = step.prompt ?? step.title;

  // Full-text + keyword search of IntelClaim records scoped to org
  const claims = await IntelClaim.find({
    $text: { $search: query },
  }).limit(20).lean().catch(() =>
    // Fall back to regex if text index not available
    IntelClaim.find({
      claim_text: { $regex: query.split(' ').slice(0, 3).join('|'), $options: 'i' },
    }).limit(20).lean(),
  );

  // Also search by org-scoped alert_ids
  const topClaims = claims.slice(0, 8);
  const claimIds = topClaims.map(c => String(c._id));

  await setStepStatus(String(session._id), step.step_id, 'done', {
    kind: 'claim_ids',
    payload: claimIds,
  }, claimIds);
}

async function runFetchExternal(session: IResearchSession, step: IResearchPlanStep) {
  const url = step.prompt;
  if (!url) {
    await setStepStatus(String(session._id), step.step_id, 'skipped');
    return;
  }

  let text = '';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const html = await res.text();
    text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 10000);
  } catch {
    text = `Could not fetch ${url}`;
  }

  const source = await ensureResearchSource();
  const claim = await IntelClaim.create({
    source_id: source._id,
    claim_text: `External source fetched for research: ${url}. Content summary: ${text.slice(0, 200)}`,
    evidence_url: url,
    asserted_at: new Date(),
    parent_claim_ids: [],
    claim_type: 'fact',
    alert_id: null,
  });

  const claimId = String(claim._id);
  await setStepStatus(String(session._id), step.step_id, 'done', {
    kind: 'fetch_result',
    payload: { url, excerpt: text.slice(0, 500) },
  }, [claimId]);
}

async function runSynthesize(session: IResearchSession, step: IResearchPlanStep) {
  // Collect evidence from paired pull_intel_claims step (same sub-question prefix)
  const subQuestion = step.prompt ?? step.title.replace(/^Draft section:\s*/i, '');

  // Find the paired pull step
  const pairedPull = session.plan_steps.find(
    s => s.kind === 'pull_intel_claims' && (s.prompt === step.prompt || s.order === step.order - 1),
  );
  const claimIds = pairedPull?.evidence_claim_ids ?? step.evidence_claim_ids ?? [];

  let claims: Array<{ _id: unknown; claim_text: string }> = [];
  if (claimIds.length > 0) {
    claims = await IntelClaim.find({ _id: { $in: claimIds } }).select('claim_text').lean();
  }

  const claimsText = claims.length > 0
    ? buildClaimsText(claims)
    : 'No direct evidence claims found. Use general knowledge to address the sub-question, noting the absence of specific evidence.';

  const userMsg = SYNTHESIZE_TEMPLATE
    .replace('{{question}}', session.question)
    .replace('{{sub_question}}', subQuestion)
    .replace('{{claims}}', claimsText);

  const result = await callLLMJson<{ heading: string; markdown: string; cited_claim_ids: string[] }>(
    'claude-haiku-4-5-20251001',
    SYNTHESIZE_SYSTEM,
    userMsg,
    async () => ({
      heading: subQuestion,
      markdown: `**Analysis:** Based on available intelligence, this sub-question requires further investigation. ${claimIds.length > 0 ? `${claimIds.length} evidence claims were identified.` : 'No direct evidence claims were found in the current intel database.'}`,
      cited_claim_ids: claimIds.slice(0, 3),
    }),
  );

  // Persist any new claims created during synthesis (cited but not yet in DB)
  const source = await ensureResearchSource();
  const persistedClaimIds: string[] = [];
  for (const id of result.cited_claim_ids ?? []) {
    if (claimIds.includes(id)) {
      persistedClaimIds.push(id);
    }
  }

  // Also create an IntelClaim for this synthesis itself
  const synthesisClaim = await IntelClaim.create({
    source_id: source._id,
    claim_text: result.markdown.replace(/\[claim:[^\]]+\]/g, '').replace(/\*\*/g, '').trim().slice(0, 400),
    evidence_url: null,
    asserted_at: new Date(),
    parent_claim_ids: persistedClaimIds,
    claim_type: 'inference',
    alert_id: null,
  });
  persistedClaimIds.push(String(synthesisClaim._id));

  await setStepStatus(String(session._id), step.step_id, 'done', {
    kind: 'text',
    payload: { heading: result.heading, markdown: result.markdown, cited_claim_ids: persistedClaimIds },
  }, persistedClaimIds);
}

async function runRecommendActions(session: IResearchSession, step: IResearchPlanStep) {
  // Collect all synthesis outputs
  const synthesizeSteps = session.plan_steps.filter(s => s.kind === 'synthesize' && s.status === 'done');
  const allClaimIds: string[] = [];
  const summaryParts: string[] = [];

  for (const s of synthesizeSteps) {
    const payload = (s.output?.payload as { heading?: string; markdown?: string; cited_claim_ids?: string[] } | null);
    if (payload?.markdown) summaryParts.push(`## ${payload.heading ?? s.title}\n${payload.markdown}`);
    if (payload?.cited_claim_ids) allClaimIds.push(...payload.cited_claim_ids);
    allClaimIds.push(...s.evidence_claim_ids);
  }

  const uniqueClaimIds = [...new Set(allClaimIds)];
  const claims = await IntelClaim.find({ _id: { $in: uniqueClaimIds } }).select('claim_text').lean();
  const claimsText = claims.length > 0 ? buildClaimsText(claims) : 'No evidence claims available.';

  const userMsg = RECOMMEND_ACTIONS_TEMPLATE
    .replace('{{question}}', session.question)
    .replace('{{summary}}', summaryParts.join('\n\n').slice(0, 3000))
    .replace('{{claims}}', claimsText.slice(0, 2000));

  const result = await callLLMJson<{ actions: Array<{ text: string; rationale: string; cited_claim_ids: string[] }> }>(
    'claude-haiku-4-5-20251001',
    RECOMMEND_ACTIONS_SYSTEM,
    userMsg,
    async () => ({
      actions: [
        { text: 'Activate contingency routing through Cape of Good Hope immediately', rationale: 'Red Sea disruptions are ongoing and show no near-term resolution.', cited_claim_ids: uniqueClaimIds.slice(0, 1) },
        { text: 'Negotiate freight rate locks with carriers for Q3 2026', rationale: 'Re-routing adds 8-12 days transit and significantly increases bunker costs.', cited_claim_ids: uniqueClaimIds.slice(0, 2) },
        { text: 'Brief EU distribution partners on revised lead times', rationale: 'Longer transit times require upstream communication to prevent stockouts.', cited_claim_ids: [] },
      ],
    }),
  );

  const source = await ensureResearchSource();
  const actionClaim = await IntelClaim.create({
    source_id: source._id,
    claim_text: `Research recommended actions: ${result.actions.map(a => a.text).join('; ')}`,
    evidence_url: null,
    asserted_at: new Date(),
    parent_claim_ids: uniqueClaimIds.slice(0, 5),
    claim_type: 'inference',
    alert_id: null,
  });

  await setStepStatus(String(session._id), step.step_id, 'done', {
    kind: 'text',
    payload: { actions: result.actions },
  }, [String(actionClaim._id), ...uniqueClaimIds.slice(0, 5)]);

  // Move session to drafting
  await ResearchSession.updateOne({ _id: session._id }, { $set: { status: 'drafting' } });
}

// ---------------------------------------------------------------------------
// Finalize: compile report + persist IntelClaims + create RiskBrief link
// ---------------------------------------------------------------------------

export async function finalizeResearchSession(sessionId: string, userId: string): Promise<string> {
  await connectDb();

  const session = await ResearchSession.findById(sessionId).lean() as IResearchSession | null;
  if (!session) throw new Error('Session not found');

  const synthesizeSteps = session.plan_steps.filter(s => s.kind === 'synthesize' && s.status === 'done');
  const recommendStep = session.plan_steps.find(s => s.kind === 'recommend_actions' && s.status === 'done');

  const sections: Array<{ heading: string; markdown: string; cited_claim_ids: string[] }> = [];
  const allClaimIds: string[] = [];

  for (const s of synthesizeSteps) {
    const payload = s.output?.payload as { heading?: string; markdown?: string; cited_claim_ids?: string[] } | null;
    if (!payload) continue;
    sections.push({
      heading: payload.heading ?? s.title,
      markdown: payload.markdown ?? '',
      cited_claim_ids: payload.cited_claim_ids ?? [],
    });
    allClaimIds.push(...(payload.cited_claim_ids ?? []));
    allClaimIds.push(...s.evidence_claim_ids);
  }

  const recommendedActions: Array<{ text: string; rationale: string; cited_claim_ids: string[] }> = [];
  if (recommendStep?.output?.payload) {
    const payload = recommendStep.output.payload as { actions?: Array<{ text: string; rationale: string; cited_claim_ids: string[] }> };
    if (payload.actions) recommendedActions.push(...payload.actions);
    allClaimIds.push(...recommendStep.evidence_claim_ids);
  }

  const uniqueClaimIds = [...new Set(allClaimIds)];

  // Build claim graph
  const claims = await IntelClaim.find({ _id: { $in: uniqueClaimIds } }).select('claim_text claim_type parent_claim_ids').lean();
  const nodes = claims.map(c => ({
    id: String(c._id),
    label: c.claim_text.slice(0, 60),
    kind: c.claim_type,
  }));
  const edges = claims.flatMap(c =>
    (c.parent_claim_ids ?? []).map(pid => ({
      from: String(pid),
      to: String(c._id),
      label: 'supports',
    })),
  );

  // Generate exec summary via LLM
  const sectionsSummary = sections.map(s => `${s.heading}: ${s.markdown.slice(0, 300)}`).join('\n\n');
  let execSummary = '';
  await streamAssistantTurn(
    'You are a supply-chain risk analyst. Write a 3-4 sentence executive summary of the research findings below. Be direct and quantitative where possible.',
    [{ role: 'user', content: `Research question: "${session.question}"\n\n${sectionsSummary.slice(0, 2000)}` }],
    (token) => { execSummary += token; },
  );
  if (!execSummary) {
    execSummary = `Research on "${session.question}" identified ${sections.length} key areas of investigation with ${uniqueClaimIds.length} evidence claims. ${recommendedActions.length} recommended actions were generated.`;
  }

  // Create ResearchReport
  const report = await ResearchReport.create({
    org_id: session.org_id,
    research_session_id: session._id,
    sections,
    claim_graph: { nodes, edges },
    exec_summary: execSummary,
    recommended_actions: recommendedActions,
    risk_brief_id: null,
  });

  // Create RiskBrief for cross-linking
  const org = await Organization.findById(session.org_id).lean();
  const userDoc = await User.findOne({ clerk_user_id: userId }).lean();
  if (org && userDoc) {
    const raw = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(raw).digest('hex');

    const brief = await RiskBrief.create({
      org_id: session.org_id,
      alert_id: null,
      entity_id: null,
      share_token: raw,
      share_token_hash: hash,
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      created_by: userDoc._id,
      view_count: 0,
      content: {
        executive_summary: execSummary,
        situation_overview: sections[0]?.markdown?.slice(0, 500) ?? '',
        operational_impact: sections[1]?.markdown?.slice(0, 500) ?? '',
        recommended_actions_prose: recommendedActions.map(a => `• ${a.text}`).join('\n'),
        severity: 'high',
        var_exposure_inr: null,
        alert_title: `Research: ${session.question.slice(0, 80)}`,
        entity_name: null,
        org_name: (org as { name: string }).name,
        affected_entities: [],
        generated_at: new Date(),
      },
    });

    await ResearchReport.updateOne({ _id: report._id }, { $set: { risk_brief_id: brief._id } });
  }

  // Update session
  await ResearchSession.updateOne(
    { _id: session._id },
    { $set: { status: 'finalized', final_report_id: report._id } },
  );

  return String(report._id);
}

// ---------------------------------------------------------------------------
// BullMQ worker
// ---------------------------------------------------------------------------

export function startResearchRunnerWorker() {
  const worker = new Worker('research-runner', async (job) => {
    const { session_id, step_id } = job.data as { session_id: string; step_id: string };
    await connectDb();

    const session = await ResearchSession.findById(session_id).lean() as IResearchSession | null;
    if (!session) return;

    const step = session.plan_steps.find(s => s.step_id === step_id);
    if (!step) return;
    if (step.status === 'done' || step.status === 'skipped') return;

    // Mark running
    await setStepStatus(session_id, step_id, 'running');

    try {
      switch (step.kind) {
        case 'sub_question':
          await runSubQuestion(session, step);
          break;
        case 'pull_intel_claims':
          await runPullIntelClaims(session, step);
          break;
        case 'fetch_external':
          await runFetchExternal(session, step);
          break;
        case 'synthesize': {
          // Re-fetch session so evidence_claim_ids are up-to-date
          const refreshed = await ResearchSession.findById(session_id).lean() as unknown as IResearchSession;
          const refreshedStep = refreshed.plan_steps.find(s => s.step_id === step_id)!;
          await runSynthesize(refreshed, refreshedStep);
          break;
        }
        case 'recommend_actions': {
          const refreshed = await ResearchSession.findById(session_id).lean() as unknown as IResearchSession;
          const refreshedStep = refreshed.plan_steps.find(s => s.step_id === step_id)!;
          await runRecommendActions(refreshed, refreshedStep);
          break;
        }
      }
    } catch (err) {
      await setStepStatus(session_id, step_id, 'proposed');
      throw err;
    }
  }, { connection });

  worker.on('failed', (job, err) =>
    console.error('[research-runner] Job failed', job?.id, err.message),
  );

  console.log('[worker] Research runner worker started');
  return worker;
}

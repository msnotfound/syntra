import { callLLMJson, renderTemplate } from '@syntra/llm';
import type { IRiskBriefContent } from '@syntra/db';

// Inlined from specs/contracts/05-llm-prompts.contract.ts — RISK_BRIEF_NARRATIVE v1.0.0
const BRIEF_MODEL = 'claude-sonnet-4-6';
const BRIEF_SYSTEM =
  'You write board-ready risk briefings. Use professional language. Structure content into clearly labelled sections. Avoid speculation — only state what is supported by the event data provided.';
const BRIEF_TEMPLATE = `Prepare a risk brief for: {{org_name}}
Generated: {{generated_at}}
Alert: {{alert_title}} (Severity: {{alert_severity}})
Event: {{event_summary}}
Affected entities: {{affected_entities}}
Estimated financial exposure: {{financial_exposure_inr}} INR
Recommended actions: {{recommended_actions}}

Write four sections: Executive Summary (≤ 3 sentences), Situation Overview (≤ 5 sentences), Operational Impact (≤ 4 sentences), Recommended Actions (prose form of the action list). Return as JSON.`;

interface NarrativeInput {
  alertTitle: string;
  alertSeverity: 'critical' | 'high' | 'medium' | 'low';
  eventSummary: string;
  affectedEntities: Array<{ name: string; type: string }>;
  financialExposureInr: number | null;
  recommendedActions: string[];
  orgName: string;
}

interface NarrativeOutput {
  executive_summary: string;
  situation_overview: string;
  operational_impact: string;
  recommended_actions_prose: string;
}

export async function generateBriefNarrative(input: NarrativeInput): Promise<NarrativeOutput> {
  const generatedAt = new Date().toISOString();
  const userMessage = renderTemplate(BRIEF_TEMPLATE, {
    org_name: input.orgName,
    generated_at: generatedAt,
    alert_title: input.alertTitle,
    alert_severity: input.alertSeverity,
    event_summary: input.eventSummary,
    affected_entities: input.affectedEntities.map(e => `${e.name} (${e.type})`).join(', '),
    financial_exposure_inr: input.financialExposureInr?.toLocaleString('en-IN') ?? 'Not calculated',
    recommended_actions: input.recommendedActions.join('; '),
  });

  const fallback = async (): Promise<NarrativeOutput> => ({
    executive_summary: `A ${input.alertSeverity}-severity event has been detected that may impact ${input.orgName}'s operations. Immediate review is recommended.`,
    situation_overview: input.eventSummary,
    operational_impact: input.affectedEntities.length > 0
      ? `The following entities are affected: ${input.affectedEntities.map(e => e.name).join(', ')}.`
      : 'Operational impact is under assessment. Consult your supply chain team.',
    recommended_actions_prose: input.recommendedActions.length > 0
      ? input.recommendedActions.join(' ')
      : 'Review the event details and consult your operations team.',
  });

  return callLLMJson<NarrativeOutput>(BRIEF_MODEL, BRIEF_SYSTEM, userMessage, fallback);
}

export function buildBriefContent(
  narrative: NarrativeOutput,
  input: NarrativeInput,
  alertTitle: string | null,
  entityName: string | null,
  varExposureInr: number | null,
): IRiskBriefContent {
  return {
    executive_summary: narrative.executive_summary,
    situation_overview: narrative.situation_overview,
    operational_impact: narrative.operational_impact,
    recommended_actions_prose: narrative.recommended_actions_prose,
    severity: input.alertSeverity,
    var_exposure_inr: varExposureInr,
    alert_title: alertTitle,
    entity_name: entityName,
    org_name: input.orgName,
    affected_entities: input.affectedEntities,
    generated_at: new Date(),
  };
}

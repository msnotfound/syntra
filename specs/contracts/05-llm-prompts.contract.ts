/**
 * @file 05-llm-prompts.contract.ts
 * @description LLM prompt template registry for Syntra v3.
 *              All LLM calls across Command-tier modules use prompts from
 *              this registry. Inline prompts in module code are CCR violations.
 *              Modify only via CCR — see specs/contracts/README.md.
 *
 * Each entry has:
 *   - id: stable string identifier
 *   - version: semver — increment on any template change
 *   - model: Claude model to use (follow cost-ladder: haiku before sonnet)
 *   - template: string with {{var}} placeholders
 *   - expected_inputs: Zod schema for template variables
 *   - expected_output_format: Zod schema the caller should validate against
 *
 * Calling modules record `prompt_id` + `version` in extraction run outputs
 * so prompt changes can be correlated with output quality regressions.
 *
 * @version 1.0.0
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Registry entry type
// ---------------------------------------------------------------------------

export interface PromptRegistryEntry<
  TInputs extends z.ZodTypeAny,
  TOutput extends z.ZodTypeAny,
> {
  readonly id: string;
  readonly version: string;
  readonly model: 'claude-haiku-4-5' | 'claude-sonnet-4-6' | 'claude-opus-4-7';
  /** Template string. Placeholders: {{variable_name}} */
  readonly template: string;
  readonly system?: string;
  readonly expected_inputs: TInputs;
  readonly expected_output_format: TOutput;
}

// ---------------------------------------------------------------------------
// WHY_THIS_MATTERS
// Generates the "why this matters to you" section in alert emails.
// Used by: alert dispatcher worker (apps/worker)
// ---------------------------------------------------------------------------

const WhyThisMattersInputsSchema = z.object({
  event_title: z.string(),
  event_description: z.string(),
  event_location: z.string(),
  affected_entities: z.array(
    z.object({ name: z.string(), type: z.string(), distance_km: z.number().optional() }),
  ),
  org_industry: z.string().nullable(),
});

const WhyThisMattersOutputSchema = z.object({
  why_matters: z.string().max(500),
});

export const WHY_THIS_MATTERS = {
  id: 'WHY_THIS_MATTERS',
  version: '1.0.0',
  model: 'claude-haiku-4-5',
  system:
    'You are a geopolitical risk analyst writing concise, factual briefings for trade operations professionals. Write in active voice. Avoid hedging language.',
  template: `Event: {{event_title}}
Description: {{event_description}}
Location: {{event_location}}
Affected entities: {{affected_entities}}
Customer industry: {{org_industry}}

In 2–3 sentences, explain why this event matters specifically to this customer's operations. Focus on business impact (supply delays, cost increases, compliance risk, route disruption). Do not repeat the event description. Do not use phrases like "it appears" or "may potentially."`,
  expected_inputs: WhyThisMattersInputsSchema,
  expected_output_format: WhyThisMattersOutputSchema,
} satisfies PromptRegistryEntry<typeof WhyThisMattersInputsSchema, typeof WhyThisMattersOutputSchema>;

// ---------------------------------------------------------------------------
// RECOMMENDED_ACTIONS
// Generates the bullet-point action list in alert emails.
// Used by: alert dispatcher worker (apps/worker)
// ---------------------------------------------------------------------------

const RecommendedActionsInputsSchema = z.object({
  event_title: z.string(),
  affected_entities: z.array(z.object({ name: z.string(), type: z.string() })),
  org_industry: z.string().nullable(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
});

const RecommendedActionsOutputSchema = z.object({
  actions: z.array(z.string()).min(1).max(4),
});

export const RECOMMENDED_ACTIONS = {
  id: 'RECOMMENDED_ACTIONS',
  version: '1.0.0',
  model: 'claude-haiku-4-5',
  system:
    'You are a supply chain risk advisor. Give concrete, actionable recommendations. Do not suggest actions that require classified information or resources the customer does not have.',
  template: `Event: {{event_title}}
Severity: {{severity}}
Affected entities: {{affected_entities}}
Customer industry: {{org_industry}}

List 2–3 specific actions the customer should take in the next 24–72 hours. Each action must be concrete and feasible for a mid-market exporter. Format as a JSON array of strings.`,
  expected_inputs: RecommendedActionsInputsSchema,
  expected_output_format: RecommendedActionsOutputSchema,
} satisfies PromptRegistryEntry<typeof RecommendedActionsInputsSchema, typeof RecommendedActionsOutputSchema>;

// ---------------------------------------------------------------------------
// ALT_ROUTE_SUGGESTION
// Suggests alternative shipping routes when a primary route is disrupted.
// Used by: M22 Alternative Route / Mitigation Suggestion Engine
// ---------------------------------------------------------------------------

const AltRouteSuggestionInputsSchema = z.object({
  disrupted_route_name: z.string(),
  disrupted_route_waypoints: z.array(z.object({ lat: z.number(), lng: z.number() })),
  origin_port: z.string(),
  destination_port: z.string(),
  cargo_type: z.string().optional(),
  event_title: z.string(),
});

const AltRouteSuggestionOutputSchema = z.object({
  alternatives: z.array(
    z.object({
      route_name: z.string(),
      via: z.string(),
      extra_days: z.number(),
      cost_delta_pct: z.number().nullable(),
      risk_notes: z.string(),
    }),
  ),
  narrative: z.string().max(400),
});

export const ALT_ROUTE_SUGGESTION = {
  id: 'ALT_ROUTE_SUGGESTION',
  version: '1.0.0',
  model: 'claude-haiku-4-5',
  system:
    'You are a maritime logistics expert. Suggest realistic alternative shipping routes based on known major trade lanes. State transit time and cost impact honestly. Do not invent ports.',
  template: `Primary route disrupted: {{disrupted_route_name}} ({{origin_port}} → {{destination_port}})
Disruption event: {{event_title}}
Cargo type: {{cargo_type}}

Suggest up to 3 alternative routing options. For each option: name the via-point or alternative lane, estimate additional transit days, estimate freight cost change as a percentage (null if unknown), and note any secondary risks. Return as JSON matching the output schema. Also write a 2-sentence narrative summary.`,
  expected_inputs: AltRouteSuggestionInputsSchema,
  expected_output_format: AltRouteSuggestionOutputSchema,
} satisfies PromptRegistryEntry<typeof AltRouteSuggestionInputsSchema, typeof AltRouteSuggestionOutputSchema>;

// ---------------------------------------------------------------------------
// RISK_BRIEF_NARRATIVE
// Generates the narrative body of a Risk Brief PDF (M26).
// Used by: M26 Risk Brief Generator
// ---------------------------------------------------------------------------

const RiskBriefNarrativeInputsSchema = z.object({
  alert_title: z.string(),
  alert_severity: z.enum(['critical', 'high', 'medium', 'low']),
  event_summary: z.string(),
  affected_entities: z.array(z.object({ name: z.string(), type: z.string() })),
  financial_exposure_inr: z.number().nullable(),
  recommended_actions: z.array(z.string()),
  org_name: z.string(),
  generated_at: z.string(),  // ISO date string
});

const RiskBriefNarrativeOutputSchema = z.object({
  executive_summary: z.string().max(300),
  situation_overview: z.string().max(600),
  operational_impact: z.string().max(400),
  recommended_actions_prose: z.string().max(400),
});

export const RISK_BRIEF_NARRATIVE = {
  id: 'RISK_BRIEF_NARRATIVE',
  version: '1.0.0',
  model: 'claude-sonnet-4-6',
  system:
    'You write board-ready risk briefings. Use professional language. Structure content into clearly labelled sections. Avoid speculation — only state what is supported by the event data provided.',
  template: `Prepare a risk brief for: {{org_name}}
Generated: {{generated_at}}
Alert: {{alert_title}} (Severity: {{alert_severity}})
Event: {{event_summary}}
Affected entities: {{affected_entities}}
Estimated financial exposure: {{financial_exposure_inr}} INR
Recommended actions: {{recommended_actions}}

Write four sections: Executive Summary (≤ 3 sentences), Situation Overview (≤ 5 sentences), Operational Impact (≤ 4 sentences), Recommended Actions (prose form of the action list). Return as JSON.`,
  expected_inputs: RiskBriefNarrativeInputsSchema,
  expected_output_format: RiskBriefNarrativeOutputSchema,
} satisfies PromptRegistryEntry<typeof RiskBriefNarrativeInputsSchema, typeof RiskBriefNarrativeOutputSchema>;

// ---------------------------------------------------------------------------
// NL_WATCHLIST_PARSE
// Parses a natural-language watchlist query into a structured filter.
// Used by: M27 Natural-Language Watchlist Query (/api/v1/watchlist/nl-query)
// ---------------------------------------------------------------------------

const NLWatchlistParseInputsSchema = z.object({
  user_query: z.string().min(5).max(500),
  available_entity_types: z.array(z.string()),
  available_regions: z.array(z.string()),
});

const NLWatchlistParseOutputSchema = z.object({
  entity_types: z.array(z.string()),
  countries: z.array(z.string()),
  regions: z.array(z.string()),
  keywords: z.array(z.string()),
  severity_threshold: z.enum(['critical', 'high', 'medium', 'low']).nullable(),
  summary: z.string().max(200),
  confidence: z.number().min(0).max(1),
});

export const NL_WATCHLIST_PARSE = {
  id: 'NL_WATCHLIST_PARSE',
  version: '1.0.0',
  model: 'claude-haiku-4-5',
  system:
    'You parse natural language queries into structured watchlist filter parameters. Return only valid JSON. If you cannot confidently parse a parameter, omit it (do not guess). Set confidence to reflect overall parse confidence.',
  template: `Available entity types: {{available_entity_types}}
Available regions: {{available_regions}}

User query: "{{user_query}}"

Parse this query into a watchlist filter. Extract: entity_types (from available list), countries (ISO codes), regions (from available list), keywords (for name matching), severity_threshold (null if not specified), summary (one sentence translating the query), confidence (0–1). Return JSON.`,
  expected_inputs: NLWatchlistParseInputsSchema,
  expected_output_format: NLWatchlistParseOutputSchema,
} satisfies PromptRegistryEntry<typeof NLWatchlistParseInputsSchema, typeof NLWatchlistParseOutputSchema>;

// ---------------------------------------------------------------------------
// Prompt registry — index all prompts here for typed access
// ---------------------------------------------------------------------------

export const LLM_PROMPT_REGISTRY = {
  WHY_THIS_MATTERS,
  RECOMMENDED_ACTIONS,
  ALT_ROUTE_SUGGESTION,
  RISK_BRIEF_NARRATIVE,
  NL_WATCHLIST_PARSE,
} as const;

export type PromptId = keyof typeof LLM_PROMPT_REGISTRY;

// ---------------------------------------------------------------------------
// Type helpers for callers
// ---------------------------------------------------------------------------

export type PromptInputs<K extends PromptId> = z.infer<
  (typeof LLM_PROMPT_REGISTRY)[K]['expected_inputs']
>;

export type PromptOutput<K extends PromptId> = z.infer<
  (typeof LLM_PROMPT_REGISTRY)[K]['expected_output_format']
>;

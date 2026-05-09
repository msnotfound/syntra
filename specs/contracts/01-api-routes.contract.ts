/**
 * @file 01-api-routes.contract.ts
 * @description Zod request/response schemas for every /api/v1/* endpoint.
 *              Existing v1 routes + v3 stubs for Command-tier modules.
 *              IMMUTABLE FROM IMPLEMENTER AGENTS — changes require a CCR.
 *
 * @version 1.0.0
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** Standard API response envelope. */
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: z.record(z.unknown()).optional(),
    error: z.null(),
  });

export const ApiErrorSchema = z.object({
  data: z.null(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().nullable(),
  }),
});

const ObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');
const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
const AlertChannelSchema = z.enum(['email', 'whatsapp', 'webhook']);
const EntityTypeSchema = z.enum(['supplier', 'port', 'route', 'country', 'region', 'asset']);

// ---------------------------------------------------------------------------
// GET /api/v1/events
// ---------------------------------------------------------------------------

export const GetEventsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  page: z.coerce.number().min(1).default(1),
  severity: SeveritySchema.optional(),
  country: z.string().length(2).toUpperCase().optional(),
});

export const EventItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  location: z.object({ lat: z.number(), lng: z.number() }),
  country: z.string(),
  country_code: z.string(),
  severity: SeveritySchema,
  event_type: z.string(),
  sources: z.array(z.object({ url: z.string(), name: z.string() })),
  occurred_at: z.coerce.date(),
  created_at: z.coerce.date(),
});

export const GetEventsResponseSchema = ApiResponseSchema(z.array(EventItemSchema));

// ---------------------------------------------------------------------------
// GET /api/v1/events/:id
// ---------------------------------------------------------------------------

export const GetEventByIdResponseSchema = ApiResponseSchema(EventItemSchema);

// ---------------------------------------------------------------------------
// GET /api/v1/alerts
// ---------------------------------------------------------------------------

export const GetAlertsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  severity: SeveritySchema.optional(),
  unacknowledged: z.coerce.boolean().optional(),
});

export const AlertItemSchema = z.object({
  id: z.string(),
  severity: SeveritySchema,
  title: z.string(),
  country: z.string(),
  location: z.object({ lat: z.number(), lng: z.number() }),
  match_reasons: z.array(z.enum(['proximity', 'country', 'route', 'supplier_country'])),
  affected_entity_count: z.number(),
  occurred_at: z.coerce.date(),
  created_at: z.coerce.date(),
  acknowledged_at: z.coerce.date().nullable(),
});

export const GetAlertsResponseSchema = ApiResponseSchema(z.array(AlertItemSchema));

// ---------------------------------------------------------------------------
// POST /api/v1/alerts/:id/acknowledge
// ---------------------------------------------------------------------------

export const AcknowledgeAlertBodySchema = z.object({
  note: z.string().max(1000).optional(),
});

export const AcknowledgeAlertResponseSchema = ApiResponseSchema(
  z.object({
    id: z.string(),
    acknowledged_at: z.coerce.date(),
  }),
);

// ---------------------------------------------------------------------------
// GET /api/v1/watchlist
// ---------------------------------------------------------------------------

export const WatchlistEntityItemSchema = z.object({
  id: z.string(),
  type: EntityTypeSchema,
  name: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  country_code: z.string().nullable(),
  region: z.string().nullable(),
  metadata: z.record(z.unknown()),
  created_at: z.coerce.date(),
});

export const GetWatchlistResponseSchema = ApiResponseSchema(z.array(WatchlistEntityItemSchema));

// ---------------------------------------------------------------------------
// POST /api/v1/watchlist
// ---------------------------------------------------------------------------

export const CreateWatchlistEntityBodySchema = z.object({
  type: EntityTypeSchema,
  name: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  country_code: z.string().length(2).toUpperCase().nullable().optional(),
  region: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const CreateWatchlistEntityResponseSchema = ApiResponseSchema(WatchlistEntityItemSchema);

// ---------------------------------------------------------------------------
// PATCH /api/v1/watchlist/:id
// ---------------------------------------------------------------------------

export const UpdateWatchlistEntityBodySchema = CreateWatchlistEntityBodySchema.partial();
export const UpdateWatchlistEntityResponseSchema = ApiResponseSchema(WatchlistEntityItemSchema);

// ---------------------------------------------------------------------------
// DELETE /api/v1/watchlist/:id
// ---------------------------------------------------------------------------

export const DeleteWatchlistEntityResponseSchema = ApiResponseSchema(
  z.object({ id: z.string(), deleted: z.literal(true) }),
);

// ---------------------------------------------------------------------------
// GET /api/v1/risk
// ---------------------------------------------------------------------------

export const GetRiskQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(5000).default(200),
});

export const GetRiskResponseSchema = ApiResponseSchema(
  z.object({
    lat: z.number(),
    lng: z.number(),
    radius_km: z.number(),
    risk_score: z.number().min(0).max(100),
    alert_count: z.number(),
    period_days: z.number(),
  }),
);

// ---------------------------------------------------------------------------
// GET /api/v1/orgs/:slug/settings  |  PATCH /api/v1/orgs/:slug/settings
// ---------------------------------------------------------------------------

export const OrgSettingsPatchBodySchema = z.object({
  severity_threshold: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  alert_channels: z.array(AlertChannelSchema).optional(),
  quiet_hours_start: z.string().nullable().optional(),
  quiet_hours_end: z.string().nullable().optional(),
  timezone: z.string().optional(),
  webhook_url: z.string().url().nullable().optional(),
});

// ---------------------------------------------------------------------------
// v3 STUBS — Command-tier endpoints (M17, M18, M20, M21, M24, M25, M27)
// ---------------------------------------------------------------------------

// POST /api/v1/sanctions/screen  (M17 Sanctions Engine)
export const SanctionsScreenBodySchema = z.object({
  entity_name: z.string().min(1),
  aliases: z.array(z.string()).optional().default([]),
  country: z.string().length(2).toUpperCase().optional(),
  lists: z
    .array(z.enum(['ofac_sdn', 'un_consolidated', 'eu_restricted', 'uk_hmt', 'india_mea']))
    .optional()
    .default(['ofac_sdn', 'un_consolidated']),
});

export const SanctionsMatchItemSchema = z.object({
  list_name: z.string(),
  matched_name: z.string(),
  match_score: z.number().min(0).max(1),
  entry: z.object({
    name: z.string(),
    aliases: z.array(z.string()),
    programs: z.array(z.string()),
    source_url: z.string(),
  }),
});

export const SanctionsScreenResponseSchema = ApiResponseSchema(
  z.object({
    screened_entity: z.string(),
    matched: z.boolean(),
    matches: z.array(SanctionsMatchItemSchema),
    screened_at: z.coerce.date(),
  }),
);

// POST /api/v1/triage/:alertId/comment  (M18 Incident Workflow)
export const TriageCommentBodySchema = z.object({
  body: z.string().min(1).max(5000),
});

export const TriageCommentResponseSchema = ApiResponseSchema(
  z.object({
    alert_id: z.string(),
    comment: z.object({
      user_id: z.string(),
      body: z.string(),
      created_at: z.coerce.date(),
    }),
  }),
);

// POST /api/v1/triage/:alertId/assign  (M18 Incident Workflow)
export const TriageAssignBodySchema = z.object({
  assignee_user_id: ObjectIdSchema.nullable(),
});

export const TriageAssignResponseSchema = ApiResponseSchema(
  z.object({
    alert_id: z.string(),
    assignee_user_id: z.string().nullable(),
    updated_at: z.coerce.date(),
  }),
);

// GET /api/v1/heatmap  (M20 Risk Heatmap)
export const GetHeatmapQuerySchema = z.object({
  period_days: z.coerce.number().min(1).max(365).default(90),
});

export const HeatmapCellSchema = z.object({
  region: z.string(),
  score: z.number().min(0).max(100),
  alert_count: z.number(),
  dominant_severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  lat_center: z.number(),
  lng_center: z.number(),
});

export const GetHeatmapResponseSchema = ApiResponseSchema(
  z.object({
    org_score: z.number().min(0).max(100),
    cells: z.array(HeatmapCellSchema),
    computed_at: z.coerce.date(),
  }),
);

// GET /api/v1/var/:entityId  (M21 VaR Engine)
export const GetVaRResponseSchema = ApiResponseSchema(
  z.object({
    entity_id: z.string(),
    entity_name: z.string(),
    var_value_usd: z.number(),
    var_value_inr: z.number(),
    confidence_interval: z.number(),
    annual_revenue_usd: z.number().nullable(),
    contribution_pct: z.number().nullable(),
    computed_at: z.coerce.date(),
  }),
);

// CRUD /api/v1/severity-rules  (M24 Custom Severity Scoring)
export const SeverityRuleSchema = z.object({
  entity_id: ObjectIdSchema.optional(),               // null = org-level default
  severity_threshold: z.enum(['critical', 'high', 'medium', 'low']),
  channels: z.array(AlertChannelSchema).optional(),
  quiet_hours_start: z.string().nullable().optional(),
  quiet_hours_end: z.string().nullable().optional(),
});

export const CreateSeverityRuleBodySchema = SeverityRuleSchema;
export const UpdateSeverityRuleBodySchema = SeverityRuleSchema.partial();

export const SeverityRuleItemSchema = SeverityRuleSchema.extend({
  id: z.string(),
  org_id: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const GetSeverityRulesResponseSchema = ApiResponseSchema(z.array(SeverityRuleItemSchema));
export const CreateSeverityRuleResponseSchema = ApiResponseSchema(SeverityRuleItemSchema);
export const UpdateSeverityRuleResponseSchema = ApiResponseSchema(SeverityRuleItemSchema);
export const DeleteSeverityRuleResponseSchema = ApiResponseSchema(
  z.object({ id: z.string(), deleted: z.literal(true) }),
);

// CRUD /api/v1/digests/preferences  (M25 Scheduled Risk Digests)
export const DigestPreferencesSchema = z.object({
  daily_enabled: z.boolean().default(false),
  daily_hour: z.number().min(0).max(23).default(8),           // 08:00 IST default
  weekly_enabled: z.boolean().default(false),
  weekly_day: z.number().min(0).max(6).default(1),            // Monday
  monthly_enabled: z.boolean().default(false),
  channels: z.array(AlertChannelSchema).default(['email']),
});

export const GetDigestPreferencesResponseSchema = ApiResponseSchema(DigestPreferencesSchema);
export const UpdateDigestPreferencesBodySchema = DigestPreferencesSchema.partial();
export const UpdateDigestPreferencesResponseSchema = ApiResponseSchema(DigestPreferencesSchema);

// POST /api/v1/watchlist/nl-query  (M27 Natural-Language Watchlist Query)
export const NLWatchlistQueryBodySchema = z.object({
  query: z.string().min(5).max(500),
});

export const ParsedWatchlistFilterSchema = z.object({
  entity_types: z.array(EntityTypeSchema).optional(),
  countries: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  severity_threshold: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  keywords: z.array(z.string()).optional(),
  summary: z.string(),                  // human-readable translation of the parsed query
});

export const NLWatchlistQueryResponseSchema = ApiResponseSchema(
  z.object({
    original_query: z.string(),
    parsed: ParsedWatchlistFilterSchema,
    confidence: z.number().min(0).max(1),
    matching_entities: z.array(WatchlistEntityItemSchema),
  }),
);

// ---------------------------------------------------------------------------
// Type exports (inferred from Zod)
// ---------------------------------------------------------------------------

export type GetEventsQuery = z.infer<typeof GetEventsQuerySchema>;
export type EventItem = z.infer<typeof EventItemSchema>;
export type AlertItem = z.infer<typeof AlertItemSchema>;
export type GetAlertsQuery = z.infer<typeof GetAlertsQuerySchema>;
export type CreateWatchlistEntityBody = z.infer<typeof CreateWatchlistEntityBodySchema>;
export type GetRiskQuery = z.infer<typeof GetRiskQuerySchema>;
export type SanctionsScreenBody = z.infer<typeof SanctionsScreenBodySchema>;
export type SanctionsMatchItem = z.infer<typeof SanctionsMatchItemSchema>;
export type TriageCommentBody = z.infer<typeof TriageCommentBodySchema>;
export type TriageAssignBody = z.infer<typeof TriageAssignBodySchema>;
export type GetHeatmapQuery = z.infer<typeof GetHeatmapQuerySchema>;
export type SeverityRule = z.infer<typeof SeverityRuleSchema>;
export type DigestPreferences = z.infer<typeof DigestPreferencesSchema>;
export type NLWatchlistQueryBody = z.infer<typeof NLWatchlistQueryBodySchema>;
export type ParsedWatchlistFilter = z.infer<typeof ParsedWatchlistFilterSchema>;

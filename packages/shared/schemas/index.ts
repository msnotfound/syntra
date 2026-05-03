import { z } from 'zod';

export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type Severity = z.infer<typeof SeveritySchema>;

export const EntityTypeSchema = z.enum(['supplier', 'port', 'route', 'country', 'region', 'asset']);
export type EntityType = z.infer<typeof EntityTypeSchema>;

export const PlanSchema = z.enum(['trial', 'starter', 'growth', 'enterprise']);
export type Plan = z.infer<typeof PlanSchema>;

export const OrgStatusSchema = z.enum(['active', 'suspended', 'cancelled']);
export type OrgStatus = z.infer<typeof OrgStatusSchema>;

export const UserRoleSchema = z.enum(['owner', 'admin', 'member']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const AlertChannelSchema = z.enum(['email', 'whatsapp', 'webhook']);
export type AlertChannel = z.infer<typeof AlertChannelSchema>;

export const MatchReasonSchema = z.enum(['proximity', 'country', 'route', 'supplier_country']);
export type MatchReason = z.infer<typeof MatchReasonSchema>;

export const OrgSettingsSchema = z.object({
  alert_channels: z.array(AlertChannelSchema),
  webhook_url: z.string().url().nullable(),
  severity_threshold: SeveritySchema,
  quiet_hours_start: z.string().nullable(),
  quiet_hours_end: z.string().nullable(),
  timezone: z.string().default('Asia/Kolkata'),
});
export type OrgSettings = z.infer<typeof OrgSettingsSchema>;

export const WatchlistEntityCreateSchema = z.object({
  type: EntityTypeSchema,
  name: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  country_code: z.string().length(2).toUpperCase().nullable().optional(),
  region: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});
export type WatchlistEntityCreate = z.infer<typeof WatchlistEntityCreateSchema>;

export const AlertAcknowledgeSchema = z.object({
  note: z.string().max(1000).optional(),
});

export const ApiKeyCreateSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(['read:events', 'read:alerts', 'write:watchlist'])),
});

export const EventLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const EventSourceSchema = z.object({
  url: z.string().url(),
  name: z.string(),
});

export const RiskQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(5000).default(200),
});

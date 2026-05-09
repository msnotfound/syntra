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

// M31 Operational Ontology schemas
const GeoPointSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export const AssetCreateSchema = z.object({
  name:         z.string().min(1).max(200),
  kind:         z.enum(['facility', 'machinery', 'inventory', 'ip']),
  location_geo: GeoPointSchema.nullable().optional().default(null),
  value_usd:    z.number().min(0),
  criticality:  z.enum(['low', 'medium', 'high', 'critical']),
});
export type AssetCreate = z.infer<typeof AssetCreateSchema>;

export const ShipmentCreateSchema = z.object({
  ref:                   z.string().min(1).max(100),
  origin_entity_id:      z.string().length(24),
  destination_entity_id: z.string().length(24),
  route_polyline:        z.array(GeoPointSchema).optional().default([]),
  status:                z.enum(['draft', 'in_transit', 'delivered', 'cancelled']).optional().default('draft'),
  eta_at:                z.string().datetime().nullable().optional().default(null),
  value_usd:             z.number().min(0),
});
export type ShipmentCreate = z.infer<typeof ShipmentCreateSchema>;

export const POItemSchema = z.object({
  description:    z.string().min(1),
  qty:            z.number().min(0),
  unit_price_usd: z.number().min(0),
});

export const PurchaseOrderCreateSchema = z.object({
  po_number:          z.string().min(1).max(100),
  supplier_entity_id: z.string().length(24),
  items:              z.array(POItemSchema).optional().default([]),
  total_usd:          z.number().min(0),
  status:             z.enum(['draft', 'approved', 'shipped', 'received', 'cancelled']).optional().default('draft'),
  due_at:             z.string().datetime().nullable().optional().default(null),
});
export type PurchaseOrderCreate = z.infer<typeof PurchaseOrderCreateSchema>;

export const CounterpartyCreateSchema = z.object({
  entity_id:              z.string().length(24),
  role:                   z.enum(['supplier', 'customer', 'broker', 'logistics']),
  risk_score:             z.number().min(0).max(100),
  relationship_value_usd: z.number().min(0),
  contract_id:            z.string().length(24).nullable().optional().default(null),
});
export type CounterpartyCreate = z.infer<typeof CounterpartyCreateSchema>;

export const ContractCreateSchema = z.object({
  counterparty_id:       z.string().length(24),
  ref:                   z.string().min(1).max(100),
  type:                  z.enum(['supply', 'service', 'distribution', 'nda', 'other']),
  value_usd:             z.number().min(0),
  expires_at:            z.string().datetime().nullable().optional().default(null),
  terms_summary:         z.string().max(5000).optional().default(''),
  force_majeure_clauses: z.array(z.string()).optional().default([]),
});
export type ContractCreate = z.infer<typeof ContractCreateSchema>;

/**
 * @file 00-data-model.contract.ts
 * @description Canonical TypeScript types for every Syntra MongoDB collection.
 *              Mirrors existing Mongoose schemas + v3 additive extensions.
 *              IMMUTABLE FROM IMPLEMENTER AGENTS — changes require a CCR.
 *              See specs/contracts/README.md for the CCR protocol.
 *
 * @version 1.0.0
 */

// ---------------------------------------------------------------------------
// Scalar aliases — keeps signatures legible without importing Mongoose
// ---------------------------------------------------------------------------

/** MongoDB ObjectId, represented as a 24-char hex string at the API layer. */
export type ObjectId = string;

// ---------------------------------------------------------------------------
// Shared enums (mirror packages/shared/schemas/index.ts)
// ---------------------------------------------------------------------------

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type Plan = 'trial' | 'starter' | 'growth' | 'enterprise';

export type OrgStatus = 'active' | 'suspended' | 'cancelled';

export type UserRole = 'owner' | 'admin' | 'member';

export type AlertChannel = 'email' | 'whatsapp' | 'webhook';

export type MatchReason = 'proximity' | 'country' | 'route' | 'supplier_country';

export type EntityType = 'supplier' | 'port' | 'route' | 'country' | 'region' | 'asset';

export type ApiKeyScope = 'read:events' | 'read:alerts' | 'write:watchlist';

// ---------------------------------------------------------------------------
// organizations
// ---------------------------------------------------------------------------

export interface OrgSettings {
  alert_channels: AlertChannel[];
  webhook_url: string | null;
  severity_threshold: Severity;
  quiet_hours_start: string | null;  // "HH:MM" IST
  quiet_hours_end: string | null;
  timezone: string;                  // default "Asia/Kolkata"
}

export interface Organization {
  _id: ObjectId;
  name: string;
  slug: string;
  plan: Plan;
  status: OrgStatus;
  trial_ends_at: Date;
  razorpay_customer_id: string | null;
  razorpay_subscription_id: string | null;
  contact_email: string;
  contact_phone: string | null;
  industry: string | null;
  settings: OrgSettings;
  demo_mode: boolean;
  created_at: Date;
  updated_at: Date;
}

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export interface User {
  _id: ObjectId;
  clerk_user_id: string;
  email: string;
  name: string;
  org_id: ObjectId;
  role: UserRole;
  created_at: Date;
  last_seen_at: Date;
}

// ---------------------------------------------------------------------------
// watchlist_entities
// ---------------------------------------------------------------------------

/** Metadata shapes per entity type. */
export interface SupplierMeta {
  industry?: string;
  importance?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}
export interface PortMeta { unlocode?: string; type?: string }
export interface RouteMeta {
  waypoints: Array<{ lat: number; lng: number }>;
  buffer_km: number;
}

/**
 * v3 VaR additions — added by M21 (VaR Engine).
 * CCR required before any implementer touches these fields.
 */
export interface WatchlistEntityVaRFields {
  annual_revenue_usd: number | null;   // annual revenue flowing through/attributed to this entity
  contribution_pct: number | null;     // pct of org revenue this entity represents (0–100)
}

export interface WatchlistEntity extends WatchlistEntityVaRFields {
  _id: ObjectId;
  org_id: ObjectId;
  type: EntityType;
  name: string;
  latitude: number | null;
  longitude: number | null;
  country_code: string | null;
  region: string | null;
  metadata: Record<string, unknown>;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ---------------------------------------------------------------------------
// alerts
// ---------------------------------------------------------------------------

export type AlertStatus = 'open' | 'triaged' | 'closed';

/** v3 alert subtype — set by the sanctions engine (M17) or matching engine. */
export type AlertSubtype = 'physical_risk' | 'sanctions_match' | 'compliance';

/** v3 triage comment — added by M18 (Incident Workflow). */
export interface AlertComment {
  user_id: ObjectId;
  body: string;
  created_at: Date;
}

export interface EventSnapshot {
  title: string;
  description: string;
  location: { lat: number; lng: number };
  country: string;
  country_code: string;
  event_type: string;
  occurred_at: Date;
  sources: Array<{ url: string; name: string }>;
}

export interface LLMContext {
  why_matters: string | null;
  recommended_actions: string[];
}

export interface Alert {
  _id: ObjectId;
  org_id: ObjectId;
  event_id: ObjectId;
  watchlist_entity_ids: ObjectId[];
  severity: Severity;
  match_reasons: MatchReason[];
  event_snapshot: EventSnapshot;
  llm_context: LLMContext;

  /** v3: narrows the alert type. Defaults to 'physical_risk' for v1 alerts. */
  subtype: AlertSubtype;

  /** v3: triage lifecycle status (M18). */
  status: AlertStatus;

  /** v3: assigned team member (M18). */
  assignee_user_id: ObjectId | null;

  /** v3: threaded comments (M18). */
  comments: AlertComment[];

  created_at: Date;
  dispatched_at: Date | null;
  channels_sent: AlertChannel[];
  acknowledged_at: Date | null;
  acknowledged_by_user_id: ObjectId | null;
  acknowledgement_note: string | null;
}

// ---------------------------------------------------------------------------
// api_keys
// ---------------------------------------------------------------------------

export interface ApiKey {
  _id: ObjectId;
  org_id: ObjectId;
  name: string;
  key_hash: string;
  key_prefix: string;
  scopes: ApiKeyScope[];
  rate_limit_per_minute: number;
  created_by_user_id: ObjectId;
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}

// ---------------------------------------------------------------------------
// subscriptions
// ---------------------------------------------------------------------------

export type SubscriptionStatus = 'active' | 'halted' | 'cancelled' | 'completed';

export interface Subscription {
  _id: ObjectId;
  org_id: ObjectId;
  plan: Plan;
  status: SubscriptionStatus;
  razorpay_subscription_id: string | null;
  razorpay_customer_id: string | null;
  current_period_start: Date;
  current_period_end: Date;
  amount_paise: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

// ---------------------------------------------------------------------------
// audit_logs
// ---------------------------------------------------------------------------

export interface AuditLog {
  _id: ObjectId;
  org_id: ObjectId;
  user_id: ObjectId | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// usage_events
// ---------------------------------------------------------------------------

export type UsageEventType = 'alert_sent' | 'api_call' | 'watchlist_added';

export interface UsageEvent {
  _id: ObjectId;
  org_id: ObjectId;
  type: UsageEventType;
  metadata: Record<string, unknown>;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// v3 NEW COLLECTIONS
// ---------------------------------------------------------------------------

/**
 * sanctions_lists — versioned snapshots of public sanctions registries.
 * Written daily by the M17 Sanctions Engine worker cron.
 */
export interface SanctionsEntry {
  name: string;
  aliases: string[];
  country: string | null;
  dob: string | null;           // ISO date string where available
  id_numbers: string[];
  programs: string[];           // e.g. ["SDN", "NPWMD"]
  source_url: string;
}

export interface SanctionsList {
  _id: ObjectId;
  list_name: 'ofac_sdn' | 'un_consolidated' | 'eu_restricted' | 'uk_hmt' | 'india_mea';
  version: string;              // date-based version e.g. "2026-05-10"
  entries: SanctionsEntry[];
  updated_at: Date;
  entry_count: number;
}

/**
 * risk_scores — computed org-level risk score (M20 Risk Heatmap).
 * Denormalized snapshot refreshed by the risk-scoring cron.
 */
export interface RiskScore {
  _id: ObjectId;
  org_id: ObjectId;
  score: number;                // 0–100
  by_region: Record<string, number>;    // region -> score
  by_route: Record<string, number>;     // route entity_id -> score
  by_severity: Record<Severity, number>;
  alert_count_7d: number;
  computed_at: Date;
}

/**
 * exposures — financial exposure view per watchlist entity (M21 VaR Engine).
 * Materialized on alert fire or on-demand recalc.
 */
export interface Exposure {
  _id: ObjectId;
  org_id: ObjectId;
  entity_id: ObjectId;
  var_value_usd: number;        // estimated value at risk in USD
  var_value_inr: number;        // estimated value at risk in INR
  confidence_interval: number;  // e.g. 0.95 = 95% CI
  computed_at: Date;
}

import { connectDb } from '@syntra/db';
import { Organization, WatchlistEntity, Event, Alert, SeverityRule } from '@syntra/db';
import type { IOrganization, IWatchlistEntity, IEvent } from '@syntra/db';
import { haversineKm, pointNearPolyline, isInQuietHours, meetsThreshold, applySeverityOverride } from '@syntra/shared';
import type { MatchReason, PlainSeverityRule } from '@syntra/shared';
export interface MatchResult {
  entities: IWatchlistEntity[];
  reasons: MatchReason[];
}

export function matchEventToEntities(
  event: { location: { lat: number; lng: number }; country_code: string },
  entities: IWatchlistEntity[],
): MatchResult {
  const matched = new Map<string, { entity: IWatchlistEntity; reasons: Set<MatchReason> }>();

  for (const entity of entities) {
    if (!entity.active) continue;
    const key = String(entity._id);

    // Proximity match (200km haversine)
    if (entity.latitude !== null && entity.longitude !== null) {
      const dist = haversineKm(entity.latitude, entity.longitude, event.location.lat, event.location.lng);
      if (dist <= 200) {
        if (!matched.has(key)) matched.set(key, { entity, reasons: new Set() });
        matched.get(key)!.reasons.add('proximity');
      }
    }

    // Country match
    if (entity.country_code && entity.country_code === event.country_code) {
      if (!matched.has(key)) matched.set(key, { entity, reasons: new Set() });
      const reasons = matched.get(key)!.reasons;
      if (entity.type === 'country' || entity.type === 'region') reasons.add('country');
      else reasons.add('supplier_country');
    }

    // Route match
    if (entity.type === 'route') {
      const meta = entity.metadata as { waypoints?: Array<{ lat: number; lng: number }>; buffer_km?: number };
      const waypoints = meta.waypoints ?? [];
      const bufferKm = meta.buffer_km ?? 200;
      if (waypoints.length >= 2 && pointNearPolyline(waypoints, event.location, bufferKm)) {
        if (!matched.has(key)) matched.set(key, { entity, reasons: new Set() });
        matched.get(key)!.reasons.add('route');
      }
    }
  }

  const entities_out: IWatchlistEntity[] = [];
  const reasons_out = new Set<MatchReason>();
  for (const { entity, reasons } of matched.values()) {
    entities_out.push(entity);
    reasons.forEach(r => reasons_out.add(r));
  }
  return { entities: entities_out, reasons: [...reasons_out] };
}

export async function runMatchingCycle(): Promise<{ processed: number; alertsCreated: number }> {
  await connectDb();
  const now = new Date();
  const since = new Date(now.getTime() - 10 * 60 * 1000); // 10-min overlap

  const events = await Event.find({ created_at: { $gte: since } }).lean();
  const orgs = await Organization.find({ status: 'active' }).lean() as unknown as IOrganization[];

  let alertsCreated = 0;

  for (const event of events) {
    for (const org of orgs) {
      const entities = await WatchlistEntity.find({ org_id: org._id, active: true }).lean() as unknown as IWatchlistEntity[];
      const { entities: matched, reasons } = matchEventToEntities(
        { location: event.location, country_code: event.country_code },
        entities,
      );
      if (matched.length === 0) continue;
      if (!meetsThreshold(event.severity, org.settings.severity_threshold)) continue;

      const defaultSeverity = event.severity as 'critical' | 'high' | 'medium' | 'low';
      const existing = await Alert.findOne({ event_id: event._id, org_id: org._id });
      if (existing) continue; // idempotency

      // Load active severity rules for this org and apply override.
      const rulesRaw = await SeverityRule.find({ org_id: org._id, active: true }).lean();
      const plainRules: PlainSeverityRule[] = rulesRaw.map(r => ({
        entity_id: String(r.entity_id),
        condition_type: r.condition_type,
        event_kind: r.event_kind,
        geo_country_code: r.geo_country_code,
        threshold: r.threshold,
      }));
      const entityIds = matched.map(e => String(e._id));
      const alertSeverity = applySeverityOverride(
        plainRules,
        entityIds,
        event.event_type,
        event.country_code,
        defaultSeverity,
      );

      const alert = await Alert.create({
        org_id: org._id,
        event_id: event._id,
        watchlist_entity_ids: matched.map(e => e._id),
        severity: alertSeverity,
        match_reasons: reasons,
        event_snapshot: {
          title: event.title,
          description: event.description,
          location: event.location,
          country: event.country,
          country_code: event.country_code,
          event_type: event.event_type,
          occurred_at: event.occurred_at,
          sources: event.sources,
        },
        llm_context: { why_matters: null, recommended_actions: [] },
      });
      alertsCreated++;

      const inQuiet = isInQuietHours(now, org.settings.quiet_hours_start, org.settings.quiet_hours_end, org.settings.timezone);
      if (!inQuiet) {
        await enqueueDispatch(String(alert._id));
      }
    }
  }

  return { processed: events.length, alertsCreated };
}

async function enqueueDispatch(alertId: string): Promise<void> {
  try {
    const { getDispatchQueue } = await import('../workers/dispatch.js');
    await getDispatchQueue().add('dispatch', { alertId }, { jobId: `alert_dispatch:${alertId}` });
  } catch {
    // Queue unavailable — log and continue
    console.warn('[matching] Could not enqueue dispatch for alert', alertId);
  }
}

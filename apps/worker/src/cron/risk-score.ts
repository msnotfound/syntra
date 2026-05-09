import { connectDb, Organization, Alert, WatchlistEntity, RiskScore } from '@syntra/db';
import type { IAlert } from '@syntra/db';
import {
  computeRiskScore,
  computeByRegion,
  computeByRoute,
  computeBySeverity,
} from '@syntra/shared';

const LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;

export async function runRiskScoreCycle(): Promise<{ orgsProcessed: number }> {
  await connectDb();
  const now = new Date();
  const since = new Date(now.getTime() - LOOKBACK_MS);
  const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const orgs = await Organization.find({ status: 'active' }).lean();
  let orgsProcessed = 0;

  for (const org of orgs) {
    const orgId = org._id;
    const alerts = await Alert.find({
      org_id: orgId,
      created_at: { $gte: since },
    }).lean() as unknown as IAlert[];

    // Build enriched alert list with region (country) and route entity ids.
    // Route entity ids are discovered by looking up entities matched in each alert.
    const entityIds = [...new Set(alerts.flatMap(a => a.watchlist_entity_ids.map(String)))];
    const entities = entityIds.length > 0
      ? await WatchlistEntity.find({ _id: { $in: entityIds } }).lean()
      : [];
    const entityMap = new Map(entities.map(e => [String(e._id), e]));

    const scored = alerts.map(a => {
      const region = a.event_snapshot.country ?? null;
      const routeEntityId = a.watchlist_entity_ids
        .map(id => entityMap.get(String(id)))
        .find(e => e?.type === 'route');
      return {
        severity: a.severity,
        created_at: a.created_at,
        region,
        route_entity_id: routeEntityId ? String(routeEntityId._id) : null,
      };
    });

    const score = computeRiskScore(scored, now);
    const by_region = computeByRegion(scored, now);
    const by_route = computeByRoute(scored, now);
    const by_severity_raw = computeBySeverity(scored, now);
    const by_severity = {
      critical: by_severity_raw.critical ?? 0,
      high: by_severity_raw.high ?? 0,
      medium: by_severity_raw.medium ?? 0,
      low: by_severity_raw.low ?? 0,
      info: by_severity_raw.info ?? 0,
    };
    const alert_count_7d = alerts.filter(a => a.created_at >= week).length;

    await RiskScore.create({
      org_id: orgId,
      score,
      by_region,
      by_route,
      by_severity,
      alert_count_7d,
      computed_at: now,
    });

    orgsProcessed++;
  }

  return { orgsProcessed };
}

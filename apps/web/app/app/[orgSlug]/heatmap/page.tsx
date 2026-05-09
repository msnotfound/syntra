import Link from 'next/link';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Alert, WatchlistEntity, RiskScore } from '@syntra/db';
import type { IAlert, IRiskScore } from '@syntra/db';
import { computeRiskScore, computeByRegion } from '@syntra/shared';
import type { Severity, EntityType } from '@syntra/shared';
import { HeatmapScoreChart } from '@/components/heatmap/HeatmapScoreChart';
import type { HeatmapCell } from '@/components/heatmap/HeatmapPanel';

interface PageProps {
  params: { orgSlug: string };
  searchParams: { type?: string; days?: string };
}

const ENTITY_TYPES: EntityType[] = ['supplier', 'port', 'route', 'country', 'region', 'asset'];

const TIME_RANGES = [
  { label: '7d',  days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

const SEVERITY_CELL: Record<Severity, string> = {
  critical: 'bg-severity-critical/20 border-severity-critical/40 text-severity-critical',
  high:     'bg-severity-high/20 border-severity-high/40 text-severity-high',
  medium:   'bg-severity-medium/20 border-severity-medium/40 text-severity-medium',
  low:      'bg-severity-low/20 border-severity-low/40 text-severity-low',
  info:     'bg-bg-surface-3 border-border-default text-text-secondary',
};

function dominantSeverity(alerts: IAlert[]): Severity {
  for (const s of ['critical', 'high', 'medium', 'low', 'info'] as Severity[]) {
    if (alerts.some(a => a.severity === s)) return s;
  }
  return 'info';
}

export default async function HeatmapPage({ params, searchParams }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);
  const orgId = org._id;

  const days = Math.max(7, Math.min(90, Number(searchParams.days) || 30));
  const entityTypeFilter = ENTITY_TYPES.includes(searchParams.type as EntityType)
    ? (searchParams.type as EntityType)
    : null;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const now = new Date();

  // Fetch alerts within time range
  let alertsRaw = await Alert.find({ org_id: orgId, created_at: { $gte: since } }).lean() as unknown as IAlert[];

  // Apply entity type filter if requested
  if (entityTypeFilter) {
    const allEntityIds = [...new Set(alertsRaw.flatMap(a => a.watchlist_entity_ids.map(String)))];
    const matchingEntities = allEntityIds.length > 0
      ? await WatchlistEntity.find({ _id: { $in: allEntityIds }, type: entityTypeFilter }).lean()
      : [];
    const matchingIds = new Set(matchingEntities.map(e => String(e._id)));
    alertsRaw = alertsRaw.filter(a =>
      a.watchlist_entity_ids.some(id => matchingIds.has(String(id))),
    );
  }

  // Compute scores
  const scored = alertsRaw.map(a => ({
    severity: a.severity,
    created_at: a.created_at,
    region: a.event_snapshot.country ?? null,
    route_entity_id: null as string | null,
  }));

  const orgScore = computeRiskScore(scored, now);
  const byRegion = computeByRegion(scored, now);

  const regionAlertMap = new Map<string, IAlert[]>();
  for (const a of alertsRaw) {
    const key = a.event_snapshot.country ?? 'Unknown';
    (regionAlertMap.get(key) ?? regionAlertMap.set(key, []).get(key))!.push(a);
  }

  const cells: HeatmapCell[] = Object.entries(byRegion)
    .map(([region, score]) => {
      const regionAlerts = regionAlertMap.get(region) ?? [];
      const locs = regionAlerts
        .map(a => a.event_snapshot.location)
        .filter(l => l?.lat != null);
      return {
        region,
        score,
        alert_count: regionAlerts.length,
        dominant_severity: dominantSeverity(regionAlerts),
        lat_center: locs.length > 0 ? locs.reduce((s, l) => s + l.lat, 0) / locs.length : 0,
        lng_center: locs.length > 0 ? locs.reduce((s, l) => s + l.lng, 0) / locs.length : 0,
      };
    })
    .sort((a, b) => b.score - a.score);

  // Fetch score history for trend chart (last 30 cached snapshots)
  const historyRaw = await RiskScore.find({ org_id: orgId })
    .sort({ computed_at: -1 })
    .limit(30)
    .select('score computed_at')
    .lean() as unknown as Pick<IRiskScore, 'score' | 'computed_at'>[];

  const history = historyRaw
    .reverse()
    .map(r => ({
      date: new Date(r.computed_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      score: r.score,
    }));

  const base = `/app/${params.orgSlug}`;

  const scoreColor = orgScore >= 75 ? 'text-severity-critical'
    : orgScore >= 50 ? 'text-severity-high'
    : orgScore >= 25 ? 'text-severity-medium'
    : 'text-severity-low';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Risk Heatmap</h1>
          <p className="text-sm text-text-secondary mt-1">
            Weighted risk score across your watchlist — last {days} days
            {entityTypeFilter ? ` · filtered by ${entityTypeFilter}` : ''}
          </p>
        </div>
        <div className={`text-right`}>
          <div className="text-xs text-text-muted mb-0.5">Org Risk Score</div>
          <span className={`text-4xl font-semibold font-mono tabular-nums ${scoreColor}`}>{orgScore}</span>
          <span className="text-text-muted text-sm"> / 100</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-muted">Time range:</span>
        {TIME_RANGES.map(({ label, days: d }) => (
          <Link
            key={label}
            href={`${base}/heatmap?days=${d}${entityTypeFilter ? `&type=${entityTypeFilter}` : ''}`}
            className={`px-2.5 h-7 flex items-center rounded-[4px] text-xs font-medium transition-colors duration-[150ms] ease-out active:scale-95 ${
              days === d
                ? 'bg-accent text-white'
                : 'bg-bg-surface-2 text-text-secondary hover:text-text-primary hover:bg-bg-surface-3'
            }`}
          >
            {label}
          </Link>
        ))}

        <span className="text-xs text-text-muted ml-2">Entity type:</span>
        <Link
          href={`${base}/heatmap?days=${days}`}
          className={`px-2.5 h-7 flex items-center rounded-[4px] text-xs font-medium transition-colors duration-[150ms] ease-out active:scale-95 ${
            !entityTypeFilter
              ? 'bg-accent text-white'
              : 'bg-bg-surface-2 text-text-secondary hover:text-text-primary hover:bg-bg-surface-3'
          }`}
        >
          All
        </Link>
        {ENTITY_TYPES.map(type => (
          <Link
            key={type}
            href={`${base}/heatmap?days=${days}&type=${type}`}
            className={`px-2.5 h-7 flex items-center rounded-[4px] text-xs font-medium capitalize transition-colors duration-[150ms] ease-out active:scale-95 ${
              entityTypeFilter === type
                ? 'bg-accent text-white'
                : 'bg-bg-surface-2 text-text-secondary hover:text-text-primary hover:bg-bg-surface-3'
            }`}
          >
            {type}
          </Link>
        ))}
      </div>

      {/* Score trend chart */}
      <div className="bg-bg-surface border border-border-subtle rounded-[6px]">
        <div className="px-4 py-3 border-b border-border-subtle">
          <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            Score Trend
          </span>
        </div>
        <div className="h-48 px-4 py-4">
          <HeatmapScoreChart history={history} />
        </div>
      </div>

      {/* Region grid */}
      <div className="bg-bg-surface border border-border-subtle rounded-[6px]">
        <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            By Region
          </span>
          <span className="text-xs text-text-muted font-mono">{cells.length} region{cells.length !== 1 ? 's' : ''}</span>
        </div>

        {cells.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="text-text-disabled text-3xl">🔭</div>
            <p className="text-sm font-medium text-text-primary">No risk data for this period</p>
            <p className="text-xs text-text-secondary max-w-xs">
              Risk scores appear after alerts are matched to your watchlist entities.
            </p>
            <Link href={`${base}/watchlist`} className="text-xs text-accent hover:text-accent transition-colors duration-[150ms]">
              Add entities to watchlist →
            </Link>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {cells.map(cell => (
              <div
                key={cell.region}
                className={`border rounded-[4px] p-3 flex flex-col gap-1 transition-colors duration-[150ms] ease-out ${SEVERITY_CELL[cell.dominant_severity]}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-text-primary truncate">{cell.region}</span>
                  <span className={`text-[10px] font-medium uppercase px-1 rounded-[3px] bg-current/10 ${SEVERITY_CELL[cell.dominant_severity].split(' ')[2]}`}>
                    {cell.dominant_severity}
                  </span>
                </div>
                <span className="text-2xl font-semibold font-mono tabular-nums">{cell.score}</span>
                <span className="text-[11px] text-text-muted">
                  {cell.alert_count} alert{cell.alert_count !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

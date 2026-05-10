import type { CSSProperties } from 'react';
import { ArrowRight, Bell, Plus } from 'lucide-react';
import Link from 'next/link';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Alert, WatchlistEntity, RiskScore } from '@syntra/db';
import { WorldMap } from '@/components/map/WorldMap';
import { SeverityBadge } from '@syntra/ui/components/SeverityBadge';
import { EntityChip } from '@syntra/ui/components/EntityChip';
import { TimeAgo } from '@syntra/ui/components/TimeAgo';
import type { IAlert, IWatchlistEntity, IRiskScore } from '@syntra/db';
import type { Severity, EntityType } from '@syntra/shared';

interface PageProps { params: { orgSlug: string } }

function staggerStyle(index: number): CSSProperties {
  return { '--stagger-index': index } as CSSProperties;
}

function MiniSparkline({ tone = 'text-accent' }: { tone?: string }) {
  return (
    <svg viewBox="0 0 96 24" aria-hidden="true" className={`h-6 w-24 ${tone}`}>
      <path
        d="M2 18 C 12 15, 18 15, 28 11 S 44 8, 54 13 S 72 18, 94 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}

export default async function OverviewPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const now = new Date();
  const day24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [recentAlertsRaw, entitiesRaw, weekAlerts, latestScore, monthAlertsRaw] = await Promise.all([
    Alert.find({ org_id: org._id, created_at: { $gte: day24h } })
      .sort({ created_at: -1 }).limit(10).populate('watchlist_entity_ids').lean(),
    WatchlistEntity.find({ org_id: org._id, active: true }).lean(),
    Alert.countDocuments({ org_id: org._id, created_at: { $gte: week } }),
    RiskScore.findOne({ org_id: org._id }).sort({ computed_at: -1 }).lean() as Promise<IRiskScore | null>,
    Alert.find({ org_id: org._id, created_at: { $gte: month } }).lean() as Promise<unknown>,
  ]);
  const recentAlerts = recentAlertsRaw as unknown as IAlert[];
  const entities = entitiesRaw as unknown as IWatchlistEntity[];
  const monthAlerts = monthAlertsRaw as unknown as IAlert[];

  const unacked = recentAlerts.filter((a) => !a.acknowledged_at).length;

  const watchlistPins = entities
    .filter(e => e.latitude !== null && e.longitude !== null)
    .map(e => ({ id: String(e._id), lat: e.latitude!, lng: e.longitude!, name: e.name, type: e.type }));

  const eventPins = recentAlerts
    .filter((a) => a.event_snapshot.location?.lat)
    .map((a) => ({
      id: String(a._id),
      lat: a.event_snapshot.location.lat,
      lng: a.event_snapshot.location.lng,
      severity: a.severity,
      title: a.event_snapshot.title,
    }));

  // Top region by alert count
  const regionCounts: Record<string, number> = {};
  for (const a of recentAlerts) {
    const r = (a.event_snapshot as { country?: string }).country ?? 'Unknown';
    regionCounts[r] = (regionCounts[r] ?? 0) + 1;
  }
  const topRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0];
  const criticalCount = recentAlerts.filter((a) => a.severity === 'critical').length;
  const riskScore = latestScore?.score ?? '—';

  const metrics = [
    { label: 'Entities monitored', value: entities.length, sub: 'live watchlist', tone: 'text-accent' },
    { label: 'Alerts this week', value: weekAlerts, sub: `${monthAlerts.length} in 30d`, tone: 'text-severity-high' },
    { label: 'Critical open', value: criticalCount, sub: `${unacked} unacked`, tone: 'text-severity-critical' },
    { label: 'Risk score', value: riskScore, sub: topRegion ? `${topRegion[0]} leading` : 'no concentration', tone: 'text-severity-medium' },
  ];

  return (
    <div className="space-y-7">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Overview</h1>
          <p className="text-sm text-text-secondary mt-1">
            {unacked} active alert{unacked !== 1 ? 's' : ''} in last 24h · {entities.length} watchlist entities monitored
          </p>
        </div>
        <Link
          href={`/app/${params.orgSlug}/watchlist`}
          className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95"
        >
          <Plus size={14} />
          Add to Watchlist
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className="stagger-reveal surface-lift rounded-md p-4"
            data-stagger-index={index}
            style={staggerStyle(index)}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-text-secondary">{metric.label}</div>
                <div className="font-mono text-2xl font-medium tabular-nums text-text-primary">{metric.value}</div>
                <div className="mt-1 text-xs text-text-muted">{metric.sub}</div>
              </div>
              <MiniSparkline tone={metric.tone} />
            </div>
          </div>
        ))}
      </div>

      {/* Map + today's intelligence */}
      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-4">
        <div className="stagger-reveal overflow-hidden rounded-md border border-border-subtle bg-bg-surface" data-stagger-index={4} style={staggerStyle(4)}>
          <WorldMap
            watchlistPins={watchlistPins}
            eventPins={eventPins}
            height="480px"
          />
        </div>

        <div className="stagger-reveal flex min-h-[480px] flex-col rounded-md border border-border-subtle bg-bg-surface" data-stagger-index={5} style={staggerStyle(5)}>
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Today&apos;s Intelligence</span>
            {unacked > 0 && (
              <span className="text-xs font-mono tabular-nums text-severity-critical">{unacked} unacked</span>
            )}
          </div>
          <div className="flex-1 overflow-auto p-3">
            {recentAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
                <Bell size={24} className="text-text-disabled" />
                <p className="text-sm font-medium text-text-primary">No alerts yet</p>
                <p className="text-xs text-text-secondary">Alerts appear here when events match your watchlist.</p>
              </div>
            ) : (
              <div className="space-y-3">
              {recentAlerts.slice(0, 6).map((alert, index) => (
                <Link
                  key={String(alert._id)}
                  href={`/app/${params.orgSlug}/alerts/${String(alert._id)}`}
                  className={`stagger-reveal block rounded-md border border-border-subtle bg-bg-base px-3 py-3 transition-colors duration-quick ease-out hover:border-border-default hover:bg-bg-surface-2 severity-border-${alert.severity}`}
                  data-stagger-index={index + 6}
                  style={staggerStyle(index + 6)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <SeverityBadge severity={alert.severity as Severity} />
                    <TimeAgo date={new Date(alert.created_at)} className="font-mono text-[11px] text-text-muted" />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-medium text-text-primary">{alert.event_snapshot.title}</p>
                  <p className="mt-1 text-xs text-text-secondary">{alert.event_snapshot.country ?? 'Unknown region'}</p>
                  {Array.isArray(alert.watchlist_entity_ids) && alert.watchlist_entity_ids.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {(alert.watchlist_entity_ids as unknown as IWatchlistEntity[]).slice(0, 2).map((entity) => (
                        <EntityChip key={String(entity._id)} type={entity.type as EntityType} name={entity.name} className="max-w-full" />
                      ))}
                    </div>
                  )}
                </Link>
              ))}
              </div>
            )}
          </div>
          <div className="px-4 py-2.5 border-t border-border-subtle">
            <Link href={`/app/${params.orgSlug}/alerts`} className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors duration-quick">
              View all <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

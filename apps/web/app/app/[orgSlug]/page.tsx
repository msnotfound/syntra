import { Plus } from 'lucide-react';
import Link from 'next/link';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Alert, WatchlistEntity, RiskScore } from '@syntra/db';
import { WorldMap } from '@/components/map/WorldMap';
import { StatCard } from '@/components/dashboard/StatCard';
import { AlertRow } from '@/components/alerts/AlertRow';
import { HeatmapPanel } from '@/components/heatmap/HeatmapPanel';
import { computeRiskScore, computeByRegion } from '@syntra/shared';
import type { IAlert, IWatchlistEntity, IRiskScore } from '@syntra/db';
import type { Severity, EntityType } from '@syntra/shared';
import type { HeatmapCell } from '@/components/heatmap/HeatmapPanel';

interface PageProps { params: { orgSlug: string } }

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

  return (
    <div className="space-y-6">
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
          className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95"
        >
          <Plus size={14} />
          Add to Watchlist
        </Link>
      </div>

      {/* Map + recent alerts */}
      <div className="grid grid-cols-[1fr_320px] gap-4">
        <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden" style={{ height: 480 }}>
          <WorldMap
            watchlistPins={watchlistPins}
            eventPins={eventPins}
            height="480px"
          />
        </div>

        {/* Active alerts sidebar */}
        <div className="bg-bg-surface border border-border-subtle rounded-md flex flex-col">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Active Alerts</span>
            {unacked > 0 && (
              <span className="text-xs font-mono tabular-nums text-severity-critical">{unacked} unacked</span>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            {recentAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
                <div className="text-text-disabled text-3xl">🔔</div>
                <p className="text-sm font-medium text-text-primary">No alerts yet</p>
                <p className="text-xs text-text-secondary">Alerts appear here when events match your watchlist.</p>
              </div>
            ) : (
              recentAlerts.slice(0, 8).map((alert) => (
                <Link
                  key={String(alert._id)}
                  href={`/app/${params.orgSlug}/alerts/${String(alert._id)}`}
                  className="block px-3 py-2.5 border-b border-border-subtle hover:bg-bg-surface-2 transition-colors duration-[150ms] ease-out"
                  style={{ borderLeft: `2px solid ${{ critical: '#EF4444', high: '#F97316', medium: '#EAB308', low: '#60A5FA' }[alert.severity as string] ?? '#94A3B8'}` }}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 inline-flex items-center px-1.5 h-4 text-[10px] font-medium uppercase tracking-wider rounded-[3px] ${{
                      critical: 'bg-severity-critical/15 text-severity-critical',
                      high: 'bg-severity-high/15 text-severity-high',
                      medium: 'bg-severity-medium/15 text-severity-medium',
                      low: 'bg-severity-low/15 text-severity-low',
                    }[alert.severity as string] ?? ''}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-text-primary mt-1 line-clamp-2">{alert.event_snapshot.title}</p>
                  <p className="text-[11px] text-text-muted font-mono mt-0.5">
                    {new Date(alert.created_at).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </Link>
              ))
            )}
          </div>
          <div className="px-4 py-2.5 border-t border-border-subtle">
            <Link href={`/app/${params.orgSlug}/alerts`} className="text-xs text-accent hover:text-accent-hover transition-colors duration-[150ms]">
              View all →
            </Link>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Entities" value={entities.length} sub="Monitored" />
        <StatCard label="Alerts This Week" value={weekAlerts} />
        <StatCard label="Avg Ack Time" value="—" sub="minutes" />
        <StatCard
          label="Top Region"
          value={topRegion ? topRegion[0] : '—'}
          sub={topRegion ? `${topRegion[1]} alert${topRegion[1] !== 1 ? 's' : ''}` : undefined}
        />
      </div>
    </div>
  );
}

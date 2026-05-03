import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Alert, WatchlistEntity } from '@syntra/db';
import { AlertRow } from '@/components/alerts/AlertRow';
import type { IAlert, IWatchlistEntity } from '@syntra/db';
import type { Severity, EntityType } from '@syntra/shared';

interface PageProps {
  params: { orgSlug: string };
  searchParams: { severity?: string; region?: string; status?: string };
}

export default async function AlertFeedPage({ params, searchParams }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const query: Record<string, unknown> = { org_id: org._id };
  if (searchParams.severity) query.severity = searchParams.severity;
  if (searchParams.status === 'unacked') query.acknowledged_at = null;
  if (searchParams.status === 'acked') query.acknowledged_at = { $ne: null };

  const thirtyDays = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  query.created_at = { $gte: thirtyDays };

  const alerts = await Alert.find(query).sort({ created_at: -1 }).limit(100).lean() as IAlert[];
  const unacked = alerts.filter(a => !a.acknowledged_at).length;

  const entityIds = [...new Set(alerts.flatMap(a => a.watchlist_entity_ids.map(String)))];
  const entities = await WatchlistEntity.find({ _id: { $in: entityIds } }).lean() as IWatchlistEntity[];
  const entityMap = new Map(entities.map(e => [String(e._id), e]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Alerts</h1>
        <p className="text-sm text-text-secondary mt-1">
          {alerts.length} alerts in last 30 days · {unacked} unacknowledged
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {(['critical','high','medium','low'] as Severity[]).map(s => (
          <a
            key={s}
            href={searchParams.severity === s ? `/app/${params.orgSlug}/alerts` : `/app/${params.orgSlug}/alerts?severity=${s}`}
            className={`px-3 h-7 rounded-md text-xs font-medium border transition-colors duration-[150ms] ease-out ${
              searchParams.severity === s
                ? 'bg-bg-surface-3 border-border-strong text-text-primary'
                : 'bg-bg-surface-2 border-border-default text-text-secondary hover:text-text-primary hover:border-border-strong'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </a>
        ))}
        <div className="flex-1" />
        <a
          href={`/app/${params.orgSlug}/alerts?status=unacked`}
          className={`px-3 h-7 rounded-md text-xs font-medium border transition-colors duration-[150ms] ease-out ${
            searchParams.status === 'unacked'
              ? 'bg-bg-surface-3 border-border-strong text-text-primary'
              : 'bg-bg-surface-2 border-border-default text-text-secondary hover:text-text-primary'
          }`}
        >
          Unacknowledged
        </a>
      </div>

      {/* Alert list */}
      <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="text-text-disabled text-4xl">🔔</div>
            <p className="text-sm font-medium text-text-primary">No alerts match your filters</p>
            <p className="text-xs text-text-secondary">Try adjusting the filters above.</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const affected = alert.watchlist_entity_ids
              .map(id => entityMap.get(String(id)))
              .filter((e): e is IWatchlistEntity => !!e)
              .map(e => ({ id: String(e._id), type: e.type as EntityType, name: e.name }));
            return (
              <AlertRow
                key={String(alert._id)}
                id={String(alert._id)}
                orgSlug={params.orgSlug}
                severity={alert.severity as Severity}
                title={alert.event_snapshot.title}
                country={alert.event_snapshot.country}
                occurredAt={new Date(alert.event_snapshot.occurred_at)}
                affectedEntities={affected}
                acknowledgedAt={alert.acknowledged_at ? new Date(alert.acknowledged_at) : null}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

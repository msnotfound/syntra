import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { DataFeed } from '@syntra/db';
import type { IDataFeed } from '@syntra/db';

interface PageProps {
  params: { orgSlug: string };
}

function StatusPill({ status }: { status: IDataFeed['last_sync_status'] }) {
  const styles: Record<IDataFeed['last_sync_status'], string> = {
    ok: 'bg-severity-low/15 border-severity-low text-severity-low',
    degraded: 'bg-severity-medium/15 border-severity-medium text-severity-medium',
    failed: 'bg-severity-critical/15 border-severity-critical text-severity-critical',
  };
  return (
    <span className={`inline-flex items-center px-2 h-5 rounded-sm text-xs font-medium border ${styles[status]}`}>
      {status}
    </span>
  );
}

function CostBadge({ model }: { model: IDataFeed['cost_model'] }) {
  const styles: Record<IDataFeed['cost_model'], string> = {
    free: 'bg-bg-surface-3 text-text-muted border-border-default',
    freemium: 'bg-severity-medium/15 border-severity-medium text-severity-medium',
    paid: 'bg-severity-high/15 border-severity-high text-severity-high',
  };
  return (
    <span className={`inline-flex items-center px-2 h-5 rounded-sm text-xs font-mono border ${styles[model]}`}>
      {model}
    </span>
  );
}

function formatRelative(date: Date | null): string {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default async function FeedsPage({ params }: PageProps) {
  await ensureDb();
  await getOrgBySlugOrThrow(params.orgSlug);

  const feeds = await DataFeed.find({}).sort({ feed_id: 1 }).lean() as unknown as IDataFeed[];

  const activeCount = feeds.filter(f => f.active).length;
  const okCount = feeds.filter(f => f.last_sync_status === 'ok' && f.last_sync_at).length;
  const totalEvents = feeds.reduce((sum, f) => sum + (f.event_count_total ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Data Feeds</h1>
        <p className="text-sm text-text-secondary mt-1">
          Open-data feed coverage — polled every 15 minutes.
          {feeds.length > 0 && (
            <span className="font-mono ml-1">
              {activeCount} active · {okCount} healthy · {totalEvents.toLocaleString()} events ingested
            </span>
          )}
        </p>
      </div>

      {feeds.length === 0 ? (
        <div className="bg-bg-surface border border-border-subtle rounded-md flex flex-col items-center justify-center py-16 gap-3">
          <div className="text-text-disabled text-3xl">—</div>
          <p className="text-sm font-medium text-text-primary">No feeds registered yet</p>
          <p className="text-xs text-text-secondary">
            Feeds register automatically when the worker starts its first poll cycle.
          </p>
        </div>
      ) : (
        <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left">
                <th className="px-4 py-3 text-xs font-medium text-text-secondary">Feed</th>
                <th className="px-4 py-3 text-xs font-medium text-text-secondary">Provider ID</th>
                <th className="px-4 py-3 text-xs font-medium text-text-secondary">Cost</th>
                <th className="px-4 py-3 text-xs font-medium text-text-secondary">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-text-secondary">Last Poll</th>
                <th className="px-4 py-3 text-xs font-medium text-text-secondary text-right">Events (24h)</th>
                <th className="px-4 py-3 text-xs font-medium text-text-secondary text-right">Events (total)</th>
              </tr>
            </thead>
            <tbody>
              {feeds.map((feed, i) => (
                <tr
                  key={String(feed._id)}
                  className={`border-b border-border-subtle transition-colors hover:bg-bg-surface-2 ${
                    i === feeds.length - 1 ? 'border-b-0' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-text-primary">{feed.name}</div>
                    {!feed.active && (
                      <div className="text-xs text-text-disabled mt-0.5">inactive</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                    {feed.provider}
                  </td>
                  <td className="px-4 py-3">
                    <CostBadge model={feed.cost_model} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={feed.last_sync_status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {formatRelative(feed.last_sync_at)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary text-right">
                    {(feed.event_count_24h ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary text-right">
                    {(feed.event_count_total ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-text-muted">
        All feeds are open-data sources. No API costs apply. Events from feeds appear in the main alert
        pipeline within 15 minutes of ingestion.
      </p>
    </div>
  );
}

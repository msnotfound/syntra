import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Alert } from '@syntra/db';
import { SeverityBadge } from '@syntra/ui/components/SeverityBadge';
import { TimeAgo } from '@syntra/ui/components/TimeAgo';
import type { IAlert } from '@syntra/db';
import type { Severity } from '@syntra/shared';

interface PageProps { params: { orgSlug: string } }

const COLUMNS: Array<{ key: IAlert['status']; label: string }> = [
  { key: 'open',    label: 'Open' },
  { key: 'triaged', label: 'Triaged' },
  { key: 'closed',  label: 'Closed' },
];

const severityBorderColor: Record<string, string> = {
  critical: '#EF4444',
  high:     '#F97316',
  medium:   '#EAB308',
  low:      '#60A5FA',
  info:     '#94A3B8',
};

export default async function TriagePage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const alerts = await Alert.find({ org_id: org._id })
    .sort({ created_at: -1 })
    .limit(200)
    .lean() as unknown as IAlert[];

  const grouped = Object.fromEntries(
    COLUMNS.map(col => [col.key, alerts.filter(a => (a.status ?? 'open') === col.key)])
  ) as Record<IAlert['status'], IAlert[]>;

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Triage Board</h1>
        <span className="text-xs text-text-muted font-mono">{alerts.length} alerts</span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
        {COLUMNS.map(col => (
          <div
            key={col.key}
            className="flex-shrink-0 w-80 flex flex-col bg-bg-surface border border-border-subtle rounded-md overflow-hidden"
          >
            {/* Column header */}
            <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                {col.label}
              </span>
              <span className="text-xs font-mono text-text-muted bg-bg-surface-2 px-1.5 py-0.5 rounded-sm">
                {grouped[col.key].length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {grouped[col.key].length === 0 && (
                <p className="text-xs text-text-muted text-center py-6">No alerts</p>
              )}
              {grouped[col.key].map(alert => (
                <Link
                  key={String(alert._id)}
                  href={`/app/${params.orgSlug}/alerts/${String(alert._id)}`}
                  className="block bg-bg-surface-2 border border-border-subtle rounded-md p-3 hover:bg-bg-surface-3 transition-colors duration-[150ms] ease-out active:scale-95"
                  style={{ borderLeftWidth: 3, borderLeftColor: severityBorderColor[alert.severity] ?? severityBorderColor.info }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <SeverityBadge severity={alert.severity as Severity} />
                  </div>
                  <p className="text-sm text-text-primary font-medium leading-snug line-clamp-2">
                    {alert.event_snapshot.title}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                    <span>{alert.event_snapshot.country}</span>
                    <TimeAgo date={new Date(alert.created_at)} className="font-mono" />
                  </div>
                  {alert.comments?.length > 0 && (
                    <div className="mt-1.5 text-xs text-text-muted font-mono">
                      {alert.comments.length} comment{alert.comments.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { SanctionsReviewQueue, SanctionsList } from '@syntra/db';
import type { ISanctionsReviewQueue, ISanctionsList } from '@syntra/db';

interface PageProps {
  params: { orgSlug: string };
  searchParams: { status?: string };
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 95
      ? 'text-severity-critical bg-severity-critical/15 border-severity-critical'
      : score >= 80
        ? 'text-severity-high bg-severity-high/15 border-severity-high'
        : 'text-text-secondary bg-bg-surface-2 border-border-default';
  return (
    <span className={`inline-flex items-center px-2 h-5 rounded-sm text-xs font-mono font-medium border ${color}`}>
      {score}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'text-severity-medium bg-severity-medium/15 border-severity-medium',
    cleared: 'text-severity-low bg-severity-low/15 border-severity-low',
    confirmed: 'text-severity-critical bg-severity-critical/15 border-severity-critical',
  };
  return (
    <span className={`inline-flex items-center px-2 h-5 rounded-sm text-xs font-medium border ${map[status] ?? ''}`}>
      {status}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="text-text-disabled text-3xl">—</div>
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}

export default async function SanctionsPage({ params, searchParams }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const statusFilter = searchParams.status ?? 'pending';

  const [queue, latestList] = await Promise.all([
    SanctionsReviewQueue.find({ org_id: org._id, status: statusFilter })
      .sort({ screened_at: -1 })
      .limit(100)
      .lean() as unknown as Promise<ISanctionsReviewQueue[]>,
    SanctionsList.findOne({ list_name: 'ofac_sdn' })
      .sort({ updated_at: -1 })
      .lean() as unknown as Promise<ISanctionsList | null>,
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Sanctions Screening</h1>
          <p className="text-sm text-text-secondary mt-1">
            Daily OFAC SDN screening against your watchlist entities.
          </p>
        </div>
        {latestList && (
          <div className="text-right">
            <p className="text-xs text-text-muted">Last sync</p>
            <p className="text-sm font-mono text-text-secondary">
              {latestList.version} · {latestList.entry_count.toLocaleString()} entries
            </p>
          </div>
        )}
      </div>

      {/* List status bar */}
      {!latestList && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-md border border-severity-medium bg-severity-medium/10 text-sm text-severity-medium">
          Sanctions list not yet synced. The daily cron runs at 02:00 UTC.
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b border-border-subtle">
        {(['pending', 'cleared', 'confirmed'] as const).map(s => (
          <a
            key={s}
            href={`/app/${params.orgSlug}/sanctions?status=${s}`}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === s
                ? 'border-accent text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </a>
        ))}
      </div>

      {/* Review queue table */}
      <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
        {queue.length === 0 ? (
          <EmptyState message={`No ${statusFilter} items in the review queue.`} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left">
                <th className="px-4 py-3 text-xs font-medium text-text-secondary">Entity</th>
                <th className="px-4 py-3 text-xs font-medium text-text-secondary">Matched Entry</th>
                <th className="px-4 py-3 text-xs font-medium text-text-secondary">List</th>
                <th className="px-4 py-3 text-xs font-medium text-text-secondary">Score</th>
                <th className="px-4 py-3 text-xs font-medium text-text-secondary">Programs</th>
                <th className="px-4 py-3 text-xs font-medium text-text-secondary">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-text-secondary">Screened</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item, i) => (
                <tr
                  key={String(item._id)}
                  className={`border-b border-border-subtle transition-colors hover:bg-bg-surface-2 ${
                    i === queue.length - 1 ? 'border-b-0' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {item.entity_name}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    <div>{item.matched_name}</div>
                    <div className="text-xs text-text-muted mt-0.5">
                      {(item.entry as { name: string }).name}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                    {item.list_name}
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={item.match_score} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {((item.entry as { programs?: string[] }).programs ?? []).map(p => (
                        <span
                          key={p}
                          className="px-1.5 h-4 rounded-sm text-xs font-mono bg-bg-surface-3 text-text-muted"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {new Date(item.screened_at).toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer note */}
      <p className="text-xs text-text-muted">
        Entities scoring ≥ 95 are auto-escalated to critical alerts. Scores 80–94 appear here for
        manual review. Source:{' '}
        <a
          href="https://sanctionssearch.ofac.treas.gov/"
          className="text-accent hover:text-accent-hover transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          OFAC SDN List
        </a>
        .
      </p>
    </div>
  );
}

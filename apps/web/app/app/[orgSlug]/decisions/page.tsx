import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Download, GitBranch } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Decision, User, IntelClaim } from '@syntra/db';
import mongoose from 'mongoose';
import { DecisionFilters } from '@/components/decisions/DecisionFilters';

interface PageProps {
  params: { orgSlug: string };
  searchParams: {
    page?: string;
    user_id?: string;
    alert_id?: string;
    type?: string;
    from?: string;
    to?: string;
  };
}

const DECISION_TYPE_LABELS: Record<string, string> = {
  acknowledged: 'Acknowledged',
  assigned: 'Assigned',
  closed: 'Closed',
  escalated: 'Escalated',
  mitigation_chosen: 'Mitigation chosen',
};

const TYPE_COLORS: Record<string, string> = {
  acknowledged: 'text-severity-low bg-severity-low/10',
  assigned: 'text-text-secondary bg-text-secondary/10',
  closed: 'text-severity-low bg-severity-low/10',
  escalated: 'text-severity-high bg-severity-high/10',
  mitigation_chosen: 'text-severity-medium bg-severity-medium/10',
};

export default async function DecisionsPage({ params, searchParams }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const page = Math.max(1, parseInt(searchParams.page ?? '1'));
  const limit = 50;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { org_id: org._id };

  if (searchParams.user_id && /^[a-f\d]{24}$/i.test(searchParams.user_id)) {
    filter.user_id = new mongoose.Types.ObjectId(searchParams.user_id);
  }
  if (searchParams.alert_id && /^[a-f\d]{24}$/i.test(searchParams.alert_id)) {
    filter.alert_id = new mongoose.Types.ObjectId(searchParams.alert_id);
  }
  if (searchParams.type) {
    filter.decision_type = searchParams.type;
  }
  if (searchParams.from || searchParams.to) {
    const dateFilter: Record<string, Date> = {};
    if (searchParams.from) dateFilter.$gte = new Date(searchParams.from);
    if (searchParams.to) dateFilter.$lte = new Date(searchParams.to);
    filter.made_at = dateFilter;
  }

  const [decisions, total, members] = await Promise.all([
    Decision.find(filter).sort({ made_at: -1 }).skip(skip).limit(limit).lean(),
    Decision.countDocuments(filter),
    User.find({ org_id: org._id }).lean(),
  ]);

  // Aggregate claim counts per alert_id for this page of decisions
  const alertIds = [...new Set(decisions.map(d => String(d.alert_id)))].filter(Boolean);
  const claimCountsRaw = alertIds.length > 0
    ? await IntelClaim.aggregate([
        { $match: { alert_id: { $in: alertIds.map(id => new mongoose.Types.ObjectId(id)) } } },
        { $group: { _id: '$alert_id', count: { $sum: 1 } } },
      ])
    : [];
  const claimCountMap = new Map<string, number>(
    claimCountsRaw.map((r: { _id: mongoose.Types.ObjectId; count: number }) => [String(r._id), r.count])
  );

  const userMap = new Map(members.map(m => [String(m._id), m.name]));
  const totalPages = Math.ceil(total / limit);

  const exportParams = new URLSearchParams();
  if (searchParams.user_id) exportParams.set('user_id', searchParams.user_id);
  if (searchParams.alert_id) exportParams.set('alert_id', searchParams.alert_id);
  if (searchParams.type) exportParams.set('type', searchParams.type);
  if (searchParams.from) exportParams.set('from', searchParams.from);
  if (searchParams.to) exportParams.set('to', searchParams.to);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="flex items-center gap-1.5 text-sm text-text-muted mb-1">
            <span>Decision Log</span>
          </nav>
          <h1 className="text-xl font-semibold text-text-primary">Decision Log</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Append-only audit trail of all decisions made on alerts.
          </p>
        </div>
        <a
          href={`/api/v1/decisions/export?${exportParams.toString()}`}
          className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-bg-surface-2 border border-border-default text-text-primary hover:bg-bg-surface-3 transition-colors duration-[150ms] ease-out active:scale-95"
        >
          <Download size={14} />
          Export CSV
        </a>
      </div>

      {/* Filters */}
      <DecisionFilters
        members={members.map(m => ({ id: String(m._id), name: m.name }))}
        currentFilters={{
          user_id: searchParams.user_id,
          alert_id: searchParams.alert_id,
          type: searchParams.type,
          from: searchParams.from,
          to: searchParams.to,
        }}
      />

      {/* Summary */}
      <div className="text-xs text-text-muted font-mono">
        {total} {total === 1 ? 'entry' : 'entries'}
        {total > limit && ` · page ${page} of ${totalPages}`}
      </div>

      {/* Table */}
      <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
        {decisions.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-text-muted">
            No decisions logged yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Alert</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Decision</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Justification</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Claims</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {decisions.map(d => (
                <tr key={String(d._id)} className="hover:bg-bg-surface-2 transition-colors duration-[150ms]">
                  <td className="px-4 py-3 font-mono text-xs text-text-muted whitespace-nowrap">
                    {d.made_at.toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' })} UTC
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {userMap.get(String(d.user_id)) ?? <span className="font-mono text-xs text-text-muted">{String(d.user_id).slice(-6)}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/${params.orgSlug}/alerts/${String(d.alert_id)}`}
                      className="font-mono text-xs text-accent hover:underline"
                    >
                      {String(d.alert_id).slice(-8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-sm text-xs font-medium ${TYPE_COLORS[d.decision_type] ?? 'text-text-secondary bg-bg-surface-2'}`}>
                      {DECISION_TYPE_LABELS[d.decision_type] ?? d.decision_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-primary max-w-xs truncate" title={d.decision_text}>
                    {d.decision_text}
                  </td>
                  <td className="px-4 py-3 text-text-secondary max-w-xs truncate" title={d.justification}>
                    {d.justification || <span className="text-text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const count = claimCountMap.get(String(d.alert_id)) ?? 0;
                      return count > 0 ? (
                        <Link
                          href={`/app/${params.orgSlug}/alerts/${String(d.alert_id)}#provenance`}
                          className="inline-flex items-center gap-1 text-xs font-mono text-accent hover:underline"
                        >
                          <GitBranch size={11} />
                          {count}
                        </Link>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted font-mono">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            {page > 1 && (
              <Link
                href={buildPageUrl(params.orgSlug, searchParams, page - 1)}
                className="px-3 h-7 flex items-center rounded-sm text-xs text-text-secondary hover:bg-bg-surface-2 transition-colors duration-[150ms]"
              >
                Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildPageUrl(params.orgSlug, searchParams, page + 1)}
                className="px-3 h-7 flex items-center rounded-sm text-xs text-text-secondary hover:bg-bg-surface-2 transition-colors duration-[150ms]"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildPageUrl(orgSlug: string, sp: PageProps['searchParams'], targetPage: number) {
  const params = new URLSearchParams();
  params.set('page', String(targetPage));
  if (sp.user_id) params.set('user_id', sp.user_id);
  if (sp.alert_id) params.set('alert_id', sp.alert_id);
  if (sp.type) params.set('type', sp.type);
  if (sp.from) params.set('from', sp.from);
  if (sp.to) params.set('to', sp.to);
  return `/app/${orgSlug}/decisions?${params.toString()}`;
}

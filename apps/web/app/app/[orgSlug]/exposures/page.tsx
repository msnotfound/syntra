import Link from 'next/link';
import { TrendingDown } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Exposure, WatchlistEntity } from '@syntra/db';
import type { IExposure, IWatchlistEntity } from '@syntra/db';

interface PageProps { params: { orgSlug: string } }

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export default async function ExposuresPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  // Latest exposure per entity: group by entity_id, pick most recent.
  const rawExposures = await Exposure.aggregate([
    { $match: { org_id: org._id } },
    { $sort: { computed_at: -1 } },
    { $group: { _id: '$entity_id', doc: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$doc' } },
    { $sort: { var_value_usd: -1 } },
  ]) as IExposure[];

  const entityIds = rawExposures.map(e => e.entity_id);
  const entities = await WatchlistEntity.find({ _id: { $in: entityIds } }).lean() as unknown as IWatchlistEntity[];
  const entityMap = new Map(entities.map(e => [String(e._id), e]));

  const totalVarUsd = rawExposures.reduce((sum, e) => sum + e.var_value_usd, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Financial Exposure</h1>
          <p className="text-sm text-text-secondary mt-1">
            Value at risk across watchlist entities, sorted by impact
          </p>
        </div>
      </div>

      {/* Summary card */}
      {rawExposures.length > 0 && (
        <div className="bg-bg-surface border border-border-subtle rounded-md p-5 flex items-center gap-6">
          <TrendingDown size={32} className="text-severity-high flex-shrink-0" />
          <div>
            <div className="text-2xl font-semibold font-mono text-text-primary">
              {formatUsd(totalVarUsd)}
            </div>
            <div className="text-sm text-text-secondary mt-0.5">
              Total portfolio exposure · {rawExposures.length} entities · 95% CI
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Entity</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">Annual Revenue</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">Contribution</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">Value at Risk</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">Last Computed</th>
            </tr>
          </thead>
          <tbody>
            {rawExposures.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-text-muted">
                  No exposure data yet. Exposures are computed when alerts fire on entities with financial data.
                </td>
              </tr>
            ) : (
              rawExposures.map((exp) => {
                const entity = entityMap.get(String(exp.entity_id));
                return (
                  <tr
                    key={String(exp._id)}
                    className="border-b border-border-subtle hover:bg-bg-surface-2 transition-colors duration-[150ms]"
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-text-primary">
                        {entity?.name ?? String(exp.entity_id)}
                      </div>
                      {exp.alert_id && (
                        <Link
                          href={`/app/${params.orgSlug}/alerts/${String(exp.alert_id)}`}
                          className="text-xs text-accent hover:underline"
                        >
                          View alert →
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary capitalize">
                      {entity?.type ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-text-secondary">
                      {entity?.annual_revenue_usd
                        ? formatUsd(entity.annual_revenue_usd)
                        : <span className="text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-text-secondary">
                      {entity?.contribution_pct != null
                        ? `${entity.contribution_pct}%`
                        : <span className="text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono font-semibold text-text-primary">
                        {formatUsd(exp.var_value_usd)}
                      </span>
                      <div className="text-xs font-mono text-text-muted">
                        ₹{(exp.var_value_inr / 10_000_000).toFixed(1)} Cr
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-text-muted">
                      {new Date(exp.computed_at).toLocaleDateString('en-GB')}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

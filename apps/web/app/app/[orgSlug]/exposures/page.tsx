import Link from 'next/link';
import { Info, TrendingDown } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Exposure, WatchlistEntity } from '@syntra/db';
import type { IExposure, IWatchlistEntity } from '@syntra/db';
import { USD_TO_INR } from '@syntra/shared';
import { radii, transitions } from '@syntra/ui/tokens';

interface PageProps { params: { orgSlug: string } }

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatInrCr(valueUsd: number): string {
  return `₹${((valueUsd * USD_TO_INR) / 10_000_000).toFixed(1)} Cr`;
}

function getBands(exp: IExposure) {
  return {
    p75: exp.simulation?.var_at_75 ?? exp.var_value_usd,
    p95: exp.simulation?.var_at_95 ?? exp.var_value_usd,
    p99: exp.simulation?.var_at_99 ?? exp.var_value_usd,
    expectedLoss: exp.simulation?.expected_loss_usd ?? exp.var_value_usd,
    stdDev: exp.simulation?.std_dev_usd ?? 0,
  };
}

function getBandWidth(value: number, max: number): string {
  if (max <= 0) return '0%';
  return `${Math.max(4, Math.min(100, (value / max) * 100)).toFixed(0)}%`;
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

  const totals = rawExposures.reduce(
    (sum, exp) => {
      const bands = getBands(exp);
      return {
        p75: sum.p75 + bands.p75,
        p95: sum.p95 + bands.p95,
        p99: sum.p99 + bands.p99,
        expectedLoss: sum.expectedLoss + bands.expectedLoss,
        stdDev: Math.sqrt((sum.stdDev * sum.stdDev) + (bands.stdDev * bands.stdDev)),
      };
    },
    { p75: 0, p95: 0, p99: 0, expectedLoss: 0, stdDev: 0 },
  );
  const simulationTooltip =
    'Simulation uses 10,000 Monte Carlo draws from alert-specific disruption-factor distributions with correlated exposure shocks. Percentiles show estimated value-at-risk bands; EL is expected loss and SD is standard deviation.';

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
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-text-primary">Portfolio VaR bands</div>
              <span
                className="relative inline-flex items-center text-text-muted group"
                title={simulationTooltip}
              >
                <Info size={14} aria-hidden="true" />
                <span className="sr-only">{simulationTooltip}</span>
                <span
                  className="pointer-events-none absolute left-5 top-1/2 z-10 hidden w-72 -translate-y-1/2 bg-bg-surface-3 border border-border-default px-3 py-2 text-xs leading-5 text-text-secondary group-hover:block"
                  style={{ borderRadius: radii.md, transition: transitions.quick }}
                >
                  {simulationTooltip}
                </span>
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4">
              {[
                ['P75', totals.p75],
                ['P95', totals.p95],
                ['P99', totals.p99],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <div className="text-xs uppercase text-text-muted">{label}</div>
                  <div className="text-2xl font-semibold font-mono text-text-primary">
                    {formatUsd(value as number)}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-sm text-text-secondary mt-2">
              EL {formatUsd(totals.expectedLoss)} · SD {formatUsd(totals.stdDev)} · {rawExposures.length} entities
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
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">
                <span className="inline-flex items-center justify-end gap-1">
                  VaR Bands
                  <Info size={13} className="text-text-muted" aria-label={simulationTooltip} />
                </span>
              </th>
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
                const bands = getBands(exp);
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
                      <div className="grid grid-cols-3 gap-3 text-right">
                        {[
                          ['75', bands.p75],
                          ['95', bands.p95],
                          ['99', bands.p99],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <div className="text-[10px] uppercase text-text-muted">P{label}</div>
                            <div className="text-sm font-mono font-semibold text-text-primary">
                              {formatUsd(value as number)}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 space-y-1" aria-hidden="true">
                        {[
                          ['P75', bands.p75],
                          ['P95', bands.p95],
                          ['P99', bands.p99],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center justify-end gap-2">
                            <span className="w-6 text-[10px] font-mono text-text-muted">{label}</span>
                            <span className="inline-block h-1.5 w-24 bg-bg-surface-3">
                              <span
                                className="block h-1.5 bg-accent"
                                style={{ width: getBandWidth(value as number, bands.p99) }}
                              />
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-xs font-mono text-text-muted">
                        EL {formatUsd(bands.expectedLoss)} · SD {formatUsd(bands.stdDev)} · P99 {formatInrCr(bands.p99)}
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

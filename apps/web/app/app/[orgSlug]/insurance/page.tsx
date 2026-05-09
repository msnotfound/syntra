import { Shield, AlertTriangle } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { InsurancePolicy, Exposure, WatchlistEntity } from '@syntra/db';
import type { IInsurancePolicy, IExposure, IWatchlistEntity } from '@syntra/db';
import { PolicyForm } from './PolicyForm';
import { CoverageChart } from './CoverageChart';
import { DeletePolicyButton } from './DeletePolicyButton';

interface PageProps { params: { orgSlug: string } }

function formatUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function expiresClass(d: Date): string {
  const daysLeft = (new Date(d).getTime() - Date.now()) / 86_400_000;
  if (daysLeft < 0) return 'text-severity-critical font-mono text-sm';
  if (daysLeft < 30) return 'text-severity-high font-mono text-sm';
  return 'text-text-secondary font-mono text-sm';
}

export default async function InsurancePage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const policies = await InsurancePolicy.find({ org_id: org._id })
    .sort({ expires_at: 1 })
    .lean() as unknown as IInsurancePolicy[];

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

  const totalVarUsd = rawExposures.reduce((s, e) => s + e.var_value_usd, 0);
  const totalGapUsd = rawExposures.reduce((s, e) => s + (e.coverage_gap_usd ?? e.var_value_usd), 0);
  const activePolicies = policies.filter(p => new Date(p.expires_at) > new Date()).length;

  const chartData = rawExposures.map(exp => ({
    name: entityMap.get(String(exp.entity_id))?.name ?? String(exp.entity_id),
    var_usd: exp.var_value_usd,
    covered_usd: exp.var_value_usd - (exp.coverage_gap_usd ?? exp.var_value_usd),
    gap_usd: exp.coverage_gap_usd ?? exp.var_value_usd,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Insurance &amp; Coverage</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage policies and track exposure coverage gaps per entity
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { label: 'Total VaR', value: formatUsd(totalVarUsd), sub: 'portfolio exposure', warn: false },
          { label: 'Coverage Gap', value: formatUsd(totalGapUsd), sub: 'uncovered exposure', warn: totalGapUsd > 0 },
          { label: 'Active Policies', value: String(activePolicies), sub: `${policies.length} total`, warn: false },
        ] as const).map(({ label, value, sub, warn }) => (
          <div key={label} className="bg-bg-surface border border-border-subtle rounded-md p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1">{label}</div>
            <div className={`text-2xl font-semibold font-mono ${warn ? 'text-severity-high' : 'text-text-primary'}`}>
              {value}
            </div>
            <div className="text-xs text-text-muted mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Exposure vs Coverage chart */}
      {chartData.length > 0 && (
        <div className="bg-bg-surface border border-border-subtle rounded-md">
          <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-2">
            <Shield size={14} className="text-accent" />
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
              Exposure vs Coverage by Entity
            </span>
          </div>
          <div className="p-5">
            <CoverageChart data={chartData} />
          </div>
        </div>
      )}

      {/* Policy table */}
      <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
        <div className="px-5 py-3 border-b border-border-subtle">
          <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Policies</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle">
              {['Policy ID', 'Insurer', 'Type', 'Max Payout', 'Deductible', 'Expires', ''].map((h, i) => (
                <th
                  key={i}
                  className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-secondary ${i >= 3 ? 'text-right' : 'text-left'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {policies.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-text-muted">
                  No policies yet. Add your first insurance policy below.
                </td>
              </tr>
            ) : (
              policies.map(p => {
                const expired = new Date(p.expires_at) < new Date();
                return (
                  <tr
                    key={String(p._id)}
                    className="border-b border-border-subtle hover:bg-bg-surface-2 transition-colors duration-[150ms]"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-text-primary">{p.policy_id}</span>
                      {expired && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded-sm bg-severity-critical/10 text-severity-critical">
                          Expired
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary">{p.insurer_name}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary capitalize">
                      {p.coverage_type.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-text-primary">
                      {formatUsd(p.max_payout_usd)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-text-secondary">
                      {formatUsd(p.deductible_usd)}
                    </td>
                    <td className={`px-4 py-3 text-right ${expiresClass(p.expires_at)}`}>
                      {new Date(p.expires_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeletePolicyButton policyId={String(p._id)} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add policy form */}
      <div className="bg-bg-surface border border-border-subtle rounded-md p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-4">Add Policy</div>
        <PolicyForm orgSlug={params.orgSlug} />
      </div>

      {/* Coverage gaps per entity */}
      {rawExposures.some(e => (e.coverage_gap_usd ?? e.var_value_usd) > 0) && (
        <div className="bg-bg-surface border border-border-subtle rounded-md">
          <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-2">
            <AlertTriangle size={14} className="text-severity-high" />
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Coverage Gaps</span>
          </div>
          <div className="divide-y divide-border-subtle">
            {rawExposures
              .filter(e => (e.coverage_gap_usd ?? e.var_value_usd) > 0)
              .map(exp => {
                const entity = entityMap.get(String(exp.entity_id));
                const gap = exp.coverage_gap_usd ?? exp.var_value_usd;
                const pct = exp.insurance_coverage_pct ?? 0;
                return (
                  <div key={String(exp._id)} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-text-primary">{entity?.name ?? String(exp.entity_id)}</div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {pct > 0 ? `${pct.toFixed(0)}% covered` : 'No coverage linked'}
                        {exp.policy_id && <span className="ml-2 font-mono">{exp.policy_id}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono font-semibold text-severity-high">{formatUsd(gap)}</div>
                      <div className="text-xs text-text-muted">uncovered</div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

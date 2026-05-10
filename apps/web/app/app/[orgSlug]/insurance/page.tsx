import { Shield, AlertTriangle, FileText } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Alert, InsurancePolicy, Exposure, WatchlistEntity } from '@syntra/db';
import type { IAlert, IInsurancePolicy, IExposure, IWatchlistEntity } from '@syntra/db';
import { colors, radii, typography } from '@syntra/ui/tokens';
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

function resolvePerilKind(alert: IAlert | undefined): string {
  if (!alert) return 'physical_risk';
  if (alert.subtype === 'sanctions_match' || alert.subtype === 'compliance') return alert.subtype;
  return alert.event_snapshot?.event_type || alert.subtype || 'physical_risk';
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}

function paidClaims(policy: IInsurancePolicy): number {
  return (policy.claims_history ?? []).reduce((sum, claim) => (
    claim.denied ? sum : sum + Math.max(0, claim.paid_usd)
  ), 0);
}

function aggregateRemaining(policy: IInsurancePolicy): number {
  return Math.max(0, (policy.aggregate_limit_usd ?? policy.max_payout_usd) - paidClaims(policy));
}

function remainingForPeril(policy: IInsurancePolicy, peril: string): number {
  if ((policy.exclusions ?? []).some(item => item.peril_kind === peril)) return 0;
  const remainingAggregate = aggregateRemaining(policy);
  const subLimit = (policy.sub_limits ?? []).find(item => item.peril_kind === peril)?.limit_usd;
  const policyLimit = Math.max(0, policy.max_payout_usd - policy.deductible_usd);
  return Math.min(remainingAggregate, subLimit ?? policyLimit, policyLimit);
}

function subLimitLabel(subLimit: IInsurancePolicy['sub_limits'][number]): string {
  if (subLimit.peril_kind) return `Peril: ${humanize(subLimit.peril_kind)}`;
  if (subLimit.counterparty_id) return `Counterparty: ${subLimit.counterparty_id}`;
  return 'Unscoped';
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
  const alertIds = rawExposures.map(e => e.alert_id).filter(Boolean);
  const alerts = await Alert.find({ _id: { $in: alertIds } }).lean() as unknown as IAlert[];
  const alertMap = new Map(alerts.map(a => [String(a._id), a]));

  const totalVarUsd = rawExposures.reduce((s, e) => s + e.var_value_usd, 0);
  const totalGapUsd = rawExposures.reduce((s, e) => s + (e.coverage_gap_usd ?? e.var_value_usd), 0);
  const totalCoveredUsd = rawExposures.reduce((s, e) => s + (e.coverage_actual_usd ?? 0), 0);
  const activePolicies = policies.filter(p => new Date(p.expires_at) > new Date()).length;
  const perilKinds = Array.from(new Set([
    ...rawExposures.map(e => resolvePerilKind(e.alert_id ? alertMap.get(String(e.alert_id)) : undefined)),
    ...policies.flatMap(p => (p.sub_limits ?? []).map(item => item.peril_kind)),
    ...policies.flatMap(p => (p.exclusions ?? []).map(item => item.peril_kind)),
  ].filter((peril): peril is string => Boolean(peril)))).sort();
  const claimsLog = policies.flatMap(policy => (policy.claims_history ?? []).map(claim => ({
    ...claim,
    policy_id: policy.policy_id,
    insurer_name: policy.insurer_name,
  }))).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const subLimitRows = policies.flatMap(policy => (policy.sub_limits ?? []).map(subLimit => ({
    ...subLimit,
    policy_id: policy.policy_id,
    insurer_name: policy.insurer_name,
  })));
  const exclusionRows = policies.flatMap(policy => (policy.exclusions ?? []).map(exclusion => ({
    ...exclusion,
    policy_id: policy.policy_id,
    insurer_name: policy.insurer_name,
  })));

  const chartData = rawExposures.map(exp => ({
    name: entityMap.get(String(exp.entity_id))?.name ?? String(exp.entity_id),
    var_usd: exp.var_value_usd,
    covered_usd: exp.coverage_actual_usd ?? (exp.var_value_usd - (exp.coverage_gap_usd ?? exp.var_value_usd)),
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {([
          { label: 'Total VaR', value: formatUsd(totalVarUsd), sub: 'portfolio exposure', warn: false },
          { label: 'Actual Coverage', value: formatUsd(totalCoveredUsd), sub: 'after limits & claims', warn: false },
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

      {/* Peril × policy matrix */}
      {policies.length > 0 && perilKinds.length > 0 && (
        <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
          <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-2">
            <Shield size={14} className="text-accent" />
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
              Coverage Matrix
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                    Peril
                  </th>
                  {policies.map(policy => (
                    <th
                      key={policy.policy_id}
                      className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-secondary"
                    >
                      {policy.policy_id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perilKinds.map(peril => (
                  <tr key={peril} className="border-b border-border-subtle">
                    <td className="px-4 py-3 text-sm capitalize text-text-primary">{humanize(peril)}</td>
                    {policies.map(policy => {
                      const paid = paidClaims(policy);
                      const remaining = remainingForPeril(policy, peril);
                      const excluded = (policy.exclusions ?? []).find(item => item.peril_kind === peril);
                      return (
                        <td key={`${peril}-${policy.policy_id}`} className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <div className="h-1.5 w-28 overflow-hidden bg-bg-surface-3" style={{ borderRadius: radii.sm }}>
                              <div
                                className="h-full"
                                style={{
                                  width: `${Math.min(100, (remaining / Math.max(1, paid + remaining)) * 100)}%`,
                                  backgroundColor: excluded ? colors.severity.critical : colors.state.success,
                                }}
                              />
                            </div>
                            <div className="font-mono text-xs text-text-primary">
                              {formatUsd(paid)} paid / {formatUsd(remaining)} rem.
                            </div>
                            {excluded && (
                              <div
                                className="max-w-48 text-xs text-severity-critical"
                                style={{ fontFamily: typography.fonts.body }}
                              >
                                {excluded.reason}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
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
              {['Policy ID', 'Insurer', 'Type', 'Max Payout', 'Aggregate Rem.', 'Deductible', 'Expires', ''].map((h, i) => (
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
                <td colSpan={8} className="px-5 py-12 text-center text-sm text-text-muted">
                  No policies yet. Add your first insurance policy below.
                </td>
              </tr>
            ) : (
              policies.map(p => {
                const expired = new Date(p.expires_at) < new Date();
                const remainingAggregate = aggregateRemaining(p);
                const aggregatePct = Math.min(100, (remainingAggregate / Math.max(1, p.aggregate_limit_usd ?? p.max_payout_usd)) * 100);
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
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-mono text-text-primary">{formatUsd(remainingAggregate)}</span>
                        <div className="h-1.5 w-24 overflow-hidden bg-bg-surface-3" style={{ borderRadius: radii.sm }}>
                          <div
                            className="h-full bg-success"
                            style={{ width: `${aggregatePct}%` }}
                          />
                        </div>
                      </div>
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

      {/* Sub-limits */}
      <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
        <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-2">
          <Shield size={14} className="text-accent" />
          <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Sub-limits</span>
        </div>
        {subLimitRows.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-text-muted">
            No peril or counterparty sub-limits configured.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                {['Policy', 'Insurer', 'Scope', 'Limit'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-secondary ${i === 3 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subLimitRows.map(row => (
                <tr key={`${row.policy_id}-${row.peril_kind ?? row.counterparty_id}`} className="border-b border-border-subtle">
                  <td className="px-4 py-3 font-mono text-sm text-text-primary">{row.policy_id}</td>
                  <td className="px-4 py-3 text-sm text-text-primary">{row.insurer_name}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{subLimitLabel(row)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-text-primary">{formatUsd(row.limit_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Exclusions */}
      <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
        <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-2">
          <AlertTriangle size={14} className="text-severity-high" />
          <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Exclusions</span>
        </div>
        {exclusionRows.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-text-muted">No exclusions configured.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                {['Policy', 'Insurer', 'Peril', 'Reason'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exclusionRows.map(row => (
                <tr key={`${row.policy_id}-${row.peril_kind}`} className="border-b border-border-subtle">
                  <td className="px-4 py-3 font-mono text-sm text-text-primary">{row.policy_id}</td>
                  <td className="px-4 py-3 text-sm text-text-primary">{row.insurer_name}</td>
                  <td className="px-4 py-3 text-sm capitalize text-text-secondary">{humanize(row.peril_kind)}</td>
                  <td className="px-4 py-3 text-sm text-severity-critical">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add policy form */}
      <div className="bg-bg-surface border border-border-subtle rounded-md p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-4">Add Policy</div>
        <PolicyForm orgSlug={params.orgSlug} />
      </div>

      {/* Claims log */}
      <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
        <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-2">
          <FileText size={14} className="text-accent" />
          <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Claims Log</span>
        </div>
        {claimsLog.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-text-muted">No claims recorded on active policies.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                {['Date', 'Claim', 'Policy', 'Insurer', 'Status', 'Paid'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-text-secondary ${i === 5 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {claimsLog.map(claim => (
                <tr key={`${claim.policy_id}-${claim.claim_id}`} className="border-b border-border-subtle">
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {new Date(claim.date).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-text-primary">{claim.claim_id}</td>
                  <td className="px-4 py-3 font-mono text-sm text-text-secondary">{claim.policy_id}</td>
                  <td className="px-4 py-3 text-sm text-text-primary">{claim.insurer_name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-1.5 py-0.5 rounded-sm text-xs ${claim.denied ? 'bg-severity-critical/10 text-severity-critical' : 'bg-success/10 text-success'}`}
                    >
                      {claim.denied ? 'Denied' : 'Paid'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-text-primary">
                    {formatUsd(claim.paid_usd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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

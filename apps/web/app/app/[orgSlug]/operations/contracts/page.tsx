import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Contract, Counterparty, WatchlistEntity } from '@syntra/db';
import type { IContract } from '@syntra/db';

interface PageProps { params: { orgSlug: string }; searchParams: { type?: string } }

const TYPE_COLOR: Record<string, string> = {
  supply:       'text-severity-low',
  service:      'text-amber-400',
  distribution: 'text-emerald-400',
  nda:          'text-text-secondary',
  other:        'text-text-muted',
};

export default async function ContractsPage({ params, searchParams }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);
  const filter: Record<string, unknown> = { org_id: org._id, active: true };
  if (searchParams.type) filter.type = searchParams.type;

  const contracts = await Contract.find(filter).sort({ created_at: -1 }).limit(100).lean() as unknown as IContract[];

  // Batch fetch counterparties → entity names
  const cpIds = [...new Set(contracts.map(c => String(c.counterparty_id)))];
  const cps = await Counterparty.find({ _id: { $in: cpIds } }).select('entity_id role').lean();
  const cpMap = Object.fromEntries(cps.map(c => [String(c._id), c]));

  const entityIds = [...new Set(cps.map(c => String(c.entity_id)))];
  const entities = await WatchlistEntity.find({ _id: { $in: entityIds } }).select('name').lean();
  const entityMap = Object.fromEntries(entities.map(e => [String(e._id), e.name]));

  const base = `/app/${params.orgSlug}/operations`;
  const TYPES = ['supply', 'service', 'distribution', 'nda', 'other'] as const;

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-text-muted mb-1">
            <Link href={base} className="hover:text-text-secondary transition-colors duration-[150ms]">Operations</Link>
            <span>/</span>
            <span className="text-text-secondary">Contracts</span>
          </div>
          <h1 className="text-xl font-semibold text-text-primary">Contract Library</h1>
          <p className="text-sm text-text-secondary mt-1">{contracts.length} contracts</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95">
          <Plus size={14} /> Add contract
        </button>
      </div>

      <div className="flex items-center gap-1">
        <Link href={`${base}/contracts`} className={`px-3 py-1.5 rounded text-xs ${!searchParams.type ? 'bg-bg-surface-2 text-text-primary' : 'text-text-secondary hover:text-text-primary'} transition-colors duration-[150ms]`}>All</Link>
        {TYPES.map(t => (
          <Link key={t} href={`${base}/contracts?type=${t}`} className={`px-3 py-1.5 rounded text-xs capitalize ${searchParams.type === t ? 'bg-bg-surface-2 text-text-primary' : 'text-text-secondary hover:text-text-primary'} transition-colors duration-[150ms]`}>{t}</Link>
        ))}
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Ref</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Counterparty</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">Value (USD)</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Expires</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-text-secondary">FM Clauses</th>
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-text-muted">No contracts found.</td></tr>
            ) : contracts.map(c => {
              const cp = cpMap[String(c.counterparty_id)] as { entity_id: unknown } | undefined;
              const entityName = cp ? entityMap[String(cp.entity_id)] : undefined;
              const expired = c.expires_at && new Date(c.expires_at) < now;
              return (
                <tr key={String(c._id)} className="border-b border-border-subtle hover:bg-bg-surface-2 transition-colors duration-[150ms]">
                  <td className="px-4 py-3">
                    <Link href={`${base}/contracts/${String(c._id)}`} className="text-sm font-medium text-text-primary font-mono hover:text-accent transition-colors duration-[150ms]">
                      {c.ref}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`${base}/counterparties/${String(c.counterparty_id)}`} className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-[150ms]">
                      {entityName ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium capitalize ${TYPE_COLOR[c.type] ?? 'text-text-secondary'}`}>{c.type}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-primary font-mono text-right">${c.value_usd.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm font-mono">
                    {c.expires_at
                      ? <span className={expired ? 'text-severity-critical' : 'text-text-muted'}>{new Date(c.expires_at).toLocaleDateString()}</span>
                      : <span className="text-text-disabled">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary font-mono text-center">
                    {c.force_majeure_clauses.length > 0
                      ? <span className="text-amber-400">{c.force_majeure_clauses.length}</span>
                      : <span className="text-text-disabled">0</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

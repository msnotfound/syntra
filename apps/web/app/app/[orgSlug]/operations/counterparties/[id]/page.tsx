import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Counterparty, Contract, WatchlistEntity } from '@syntra/db';
import type { ICounterparty, IContract } from '@syntra/db';

interface PageProps { params: { orgSlug: string; id: string } }

const TYPE_COLOR: Record<string, string> = {
  supply:       'text-severity-low',
  service:      'text-amber-400',
  distribution: 'text-emerald-400',
  nda:          'text-text-secondary',
  other:        'text-text-muted',
};

export default async function CounterpartyDetailPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);
  const cp = await Counterparty.findOne({ _id: params.id, org_id: org._id }).lean() as unknown as ICounterparty | null;
  if (!cp) notFound();

  const [entity, contracts] = await Promise.all([
    WatchlistEntity.findById(cp.entity_id).lean(),
    Contract.find({ org_id: org._id, counterparty_id: params.id, active: true }).lean() as unknown as Promise<IContract[]>,
  ]);

  const base = `/app/${params.orgSlug}/operations`;
  const riskColor = cp.risk_score >= 70 ? '#EF4444' : cp.risk_score >= 40 ? '#F97316' : '#60A5FA';
  const now = new Date();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-text-muted mb-1">
          <Link href={base} className="hover:text-text-secondary transition-colors duration-[150ms]">Operations</Link>
          <span>/</span>
          <Link href={`${base}/counterparties`} className="hover:text-text-secondary transition-colors duration-[150ms]">Counterparties</Link>
          <span>/</span>
          <span className="text-text-secondary font-mono">{String(cp._id).slice(-8)}</span>
        </div>
        <div className="flex items-start justify-between">
          <h1 className="text-xl font-semibold text-text-primary">
            {entity ? (entity as { name: string }).name : String(cp.entity_id)}
          </h1>
          <span className="text-xs font-medium text-text-secondary capitalize bg-bg-surface-2 px-2 py-0.5 rounded">{cp.role}</span>
        </div>
      </div>

      {/* Risk score prominent display */}
      <div className="bg-bg-surface border border-border-subtle rounded-md p-4 flex items-center gap-6">
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Risk Score</p>
          <p className="text-4xl font-semibold font-mono" style={{ color: riskColor }}>{cp.risk_score}</p>
        </div>
        <div className="flex-1">
          <div className="h-2 bg-bg-surface-3 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-colors duration-300" style={{ width: `${cp.risk_score}%`, backgroundColor: riskColor }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-text-disabled">0</span>
            <span className="text-xs text-text-disabled">100</span>
          </div>
        </div>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-md divide-y divide-border-subtle">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-text-muted">Entity</span>
          {entity
            ? <Link href={`/app/${params.orgSlug}/watchlist`} className="text-sm text-accent hover:underline">{(entity as { name: string }).name}</Link>
            : <span className="text-sm text-text-muted font-mono">{String(cp.entity_id)}</span>}
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-text-muted">Relationship value (USD)</span>
          <span className="text-sm text-text-primary font-mono">${cp.relationship_value_usd.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-text-muted">Primary contract</span>
          {cp.contract_id
            ? <Link href={`${base}/contracts/${String(cp.contract_id)}`} className="text-sm text-accent font-mono hover:underline">{String(cp.contract_id).slice(-8)}</Link>
            : <span className="text-sm text-text-disabled">—</span>}
        </div>
      </div>

      {/* Cross-link: Contracts for this counterparty */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-2">Contracts <span className="font-mono text-text-muted text-xs ml-1">{contracts.length}</span></h2>
        {contracts.length === 0 ? (
          <p className="text-sm text-text-muted">No contracts found for this counterparty.</p>
        ) : (
          <div className="bg-bg-surface border border-border-subtle rounded-md divide-y divide-border-subtle">
            {contracts.map(c => {
              const expired = c.expires_at && new Date(c.expires_at) < now;
              return (
                <Link key={String(c._id)} href={`${base}/contracts/${String(c._id)}`} className="flex items-center justify-between px-4 py-3 hover:bg-bg-surface-2 transition-colors duration-[150ms]">
                  <div>
                    <span className="text-sm font-mono text-text-primary">{c.ref}</span>
                    <span className={`ml-3 text-xs capitalize ${TYPE_COLOR[c.type] ?? 'text-text-secondary'}`}>{c.type}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono text-text-secondary">${c.value_usd.toLocaleString()}</span>
                    {c.expires_at && (
                      <span className={`text-xs font-mono ${expired ? 'text-severity-critical' : 'text-text-muted'}`}>
                        exp {new Date(c.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

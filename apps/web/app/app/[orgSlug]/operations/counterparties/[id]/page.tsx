import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Counterparty, Contract, WatchlistEntity } from '@syntra/db';
import type { ICounterparty, IContract } from '@syntra/db';

interface PageProps { params: { orgSlug: string; id: string } }

const TYPE_COLOR: Record<string, string> = {
  supply:       'text-[#60A5FA]',
  service:      'text-amber-400',
  distribution: 'text-emerald-400',
  nda:          'text-[#94A3B8]',
  other:        'text-[#64748B]',
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
        <div className="flex items-center gap-2 text-sm text-[#64748B] mb-1">
          <Link href={base} className="hover:text-[#94A3B8] transition-colors duration-[150ms]">Operations</Link>
          <span>/</span>
          <Link href={`${base}/counterparties`} className="hover:text-[#94A3B8] transition-colors duration-[150ms]">Counterparties</Link>
          <span>/</span>
          <span className="text-[#94A3B8] font-mono">{String(cp._id).slice(-8)}</span>
        </div>
        <div className="flex items-start justify-between">
          <h1 className="text-xl font-semibold text-[#FAFAFA]">
            {entity ? (entity as { name: string }).name : String(cp.entity_id)}
          </h1>
          <span className="text-xs font-medium text-[#94A3B8] capitalize bg-[#1E2530] px-2 py-0.5 rounded">{cp.role}</span>
        </div>
      </div>

      {/* Risk score prominent display */}
      <div className="bg-[#151921] border border-[#1E2530] rounded-md p-4 flex items-center gap-6">
        <div>
          <p className="text-xs text-[#64748B] uppercase tracking-wider mb-1">Risk Score</p>
          <p className="text-4xl font-semibold font-mono" style={{ color: riskColor }}>{cp.risk_score}</p>
        </div>
        <div className="flex-1">
          <div className="h-2 bg-[#262C36] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${cp.risk_score}%`, backgroundColor: riskColor }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-[#475569]">0</span>
            <span className="text-xs text-[#475569]">100</span>
          </div>
        </div>
      </div>

      <div className="bg-[#151921] border border-[#1E2530] rounded-md divide-y divide-[#1E2530]">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-[#64748B]">Entity</span>
          {entity
            ? <Link href={`/app/${params.orgSlug}/watchlist`} className="text-sm text-[#3B82F6] hover:underline">{(entity as { name: string }).name}</Link>
            : <span className="text-sm text-[#64748B] font-mono">{String(cp.entity_id)}</span>}
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-[#64748B]">Relationship value (USD)</span>
          <span className="text-sm text-[#FAFAFA] font-mono">${cp.relationship_value_usd.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-[#64748B]">Primary contract</span>
          {cp.contract_id
            ? <Link href={`${base}/contracts/${String(cp.contract_id)}`} className="text-sm text-[#3B82F6] font-mono hover:underline">{String(cp.contract_id).slice(-8)}</Link>
            : <span className="text-sm text-[#475569]">—</span>}
        </div>
      </div>

      {/* Cross-link: Contracts for this counterparty */}
      <div>
        <h2 className="text-sm font-semibold text-[#FAFAFA] mb-2">Contracts <span className="font-mono text-[#64748B] text-xs ml-1">{contracts.length}</span></h2>
        {contracts.length === 0 ? (
          <p className="text-sm text-[#64748B]">No contracts found for this counterparty.</p>
        ) : (
          <div className="bg-[#151921] border border-[#1E2530] rounded-md divide-y divide-[#1E2530]">
            {contracts.map(c => {
              const expired = c.expires_at && new Date(c.expires_at) < now;
              return (
                <Link key={String(c._id)} href={`${base}/contracts/${String(c._id)}`} className="flex items-center justify-between px-4 py-3 hover:bg-[#1E2530] transition-colors duration-[150ms]">
                  <div>
                    <span className="text-sm font-mono text-[#FAFAFA]">{c.ref}</span>
                    <span className={`ml-3 text-xs capitalize ${TYPE_COLOR[c.type] ?? 'text-[#94A3B8]'}`}>{c.type}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono text-[#94A3B8]">${c.value_usd.toLocaleString()}</span>
                    {c.expires_at && (
                      <span className={`text-xs font-mono ${expired ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>
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

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Contract, Counterparty, WatchlistEntity } from '@syntra/db';
import type { IContract, ICounterparty } from '@syntra/db';

interface PageProps { params: { orgSlug: string; id: string } }

export default async function ContractDetailPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);
  const contract = await Contract.findOne({ _id: params.id, org_id: org._id }).lean() as unknown as IContract | null;
  if (!contract) notFound();

  const counterparty = await Counterparty.findById(contract.counterparty_id).lean() as ICounterparty | null;
  const entity = counterparty ? await WatchlistEntity.findById(counterparty.entity_id).lean() : null;

  const base = `/app/${params.orgSlug}/operations`;
  const now = new Date();
  const expired = contract.expires_at && new Date(contract.expires_at) < now;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-[#64748B] mb-1">
          <Link href={base} className="hover:text-[#94A3B8] transition-colors duration-[150ms]">Operations</Link>
          <span>/</span>
          <Link href={`${base}/contracts`} className="hover:text-[#94A3B8] transition-colors duration-[150ms]">Contracts</Link>
          <span>/</span>
          <span className="text-[#94A3B8] font-mono">{contract.ref}</span>
        </div>
        <div className="flex items-start justify-between">
          <h1 className="text-xl font-semibold text-[#FAFAFA] font-mono">{contract.ref}</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#94A3B8] capitalize bg-[#1E2530] px-2 py-0.5 rounded">{contract.type}</span>
            {expired && <span className="text-xs text-[#EF4444] bg-[#EF4444]/10 px-2 py-0.5 rounded">Expired</span>}
          </div>
        </div>
      </div>

      {/* Cross-link: Counterparty */}
      {counterparty && (
        <Link href={`${base}/counterparties/${String(counterparty._id)}`} className="flex items-center justify-between bg-[#151921] border border-[#1E2530] rounded-md px-4 py-3 hover:bg-[#1E2530] transition-colors duration-[150ms]">
          <div>
            <p className="text-xs text-[#64748B] mb-0.5">Counterparty</p>
            <p className="text-sm text-[#FAFAFA]">{entity ? (entity as { name: string }).name : String(counterparty._id)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#64748B] mb-0.5 capitalize">{counterparty.role}</p>
            <p className={`text-sm font-mono ${counterparty.risk_score >= 70 ? 'text-[#EF4444]' : counterparty.risk_score >= 40 ? 'text-[#F97316]' : 'text-[#60A5FA]'}`}>
              Risk {counterparty.risk_score}
            </p>
          </div>
        </Link>
      )}

      <div className="bg-[#151921] border border-[#1E2530] rounded-md divide-y divide-[#1E2530]">
        {[
          { label: 'Value (USD)', value: `$${contract.value_usd.toLocaleString()}`, mono: true },
          { label: 'Expires', value: contract.expires_at ? new Date(contract.expires_at).toISOString() : '—', mono: true },
          { label: 'Created', value: new Date(contract.created_at).toISOString(), mono: true },
        ].map(row => (
          <div key={row.label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-[#64748B]">{row.label}</span>
            <span className={`text-sm text-[#FAFAFA] ${row.mono ? 'font-mono' : ''}`}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Terms summary */}
      {contract.terms_summary && (
        <div>
          <h2 className="text-sm font-semibold text-[#FAFAFA] mb-2">Terms summary</h2>
          <div className="bg-[#151921] border border-[#1E2530] rounded-md px-4 py-3">
            <p className="text-sm text-[#94A3B8] leading-relaxed">{contract.terms_summary}</p>
          </div>
        </div>
      )}

      {/* Force majeure clauses */}
      <div>
        <h2 className="text-sm font-semibold text-[#FAFAFA] mb-2">
          Force majeure clauses
          <span className="ml-2 font-mono text-xs text-[#64748B]">{contract.force_majeure_clauses.length}</span>
        </h2>
        {contract.force_majeure_clauses.length === 0 ? (
          <p className="text-sm text-[#64748B]">No clauses extracted.</p>
        ) : (
          <ul className="space-y-2">
            {contract.force_majeure_clauses.map((clause, i) => (
              <li key={i} className="bg-[#151921] border border-[#1E2530] rounded-md px-4 py-3 flex gap-3">
                <span className="text-xs font-mono text-[#475569] mt-0.5 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <p className="text-sm text-[#94A3B8]">{clause}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

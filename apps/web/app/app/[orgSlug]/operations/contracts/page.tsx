import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Contract, Counterparty, WatchlistEntity } from '@syntra/db';
import type { IContract } from '@syntra/db';

interface PageProps { params: { orgSlug: string }; searchParams: { type?: string } }

const TYPE_COLOR: Record<string, string> = {
  supply:       'text-[#60A5FA]',
  service:      'text-amber-400',
  distribution: 'text-emerald-400',
  nda:          'text-[#94A3B8]',
  other:        'text-[#64748B]',
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
          <div className="flex items-center gap-2 text-sm text-[#64748B] mb-1">
            <Link href={base} className="hover:text-[#94A3B8] transition-colors duration-[150ms]">Operations</Link>
            <span>/</span>
            <span className="text-[#94A3B8]">Contracts</span>
          </div>
          <h1 className="text-xl font-semibold text-[#FAFAFA]">Contract Library</h1>
          <p className="text-sm text-[#94A3B8] mt-1">{contracts.length} contracts</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-[#3B82F6] text-white hover:bg-blue-500 transition-colors duration-[150ms] ease-out active:scale-95">
          <Plus size={14} /> Add contract
        </button>
      </div>

      <div className="flex items-center gap-1">
        <Link href={`${base}/contracts`} className={`px-3 py-1.5 rounded text-xs ${!searchParams.type ? 'bg-[#1E2530] text-[#FAFAFA]' : 'text-[#94A3B8] hover:text-[#FAFAFA]'} transition-colors duration-[150ms]`}>All</Link>
        {TYPES.map(t => (
          <Link key={t} href={`${base}/contracts?type=${t}`} className={`px-3 py-1.5 rounded text-xs capitalize ${searchParams.type === t ? 'bg-[#1E2530] text-[#FAFAFA]' : 'text-[#94A3B8] hover:text-[#FAFAFA]'} transition-colors duration-[150ms]`}>{t}</Link>
        ))}
      </div>

      <div className="bg-[#151921] border border-[#1E2530] rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1E2530]">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Ref</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Counterparty</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Value (USD)</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Expires</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[#94A3B8]">FM Clauses</th>
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[#64748B]">No contracts found.</td></tr>
            ) : contracts.map(c => {
              const cp = cpMap[String(c.counterparty_id)] as { entity_id: unknown } | undefined;
              const entityName = cp ? entityMap[String(cp.entity_id)] : undefined;
              const expired = c.expires_at && new Date(c.expires_at) < now;
              return (
                <tr key={String(c._id)} className="border-b border-[#1E2530] hover:bg-[#1E2530] transition-colors duration-[150ms]">
                  <td className="px-4 py-3">
                    <Link href={`${base}/contracts/${String(c._id)}`} className="text-sm font-medium text-[#FAFAFA] font-mono hover:text-[#3B82F6] transition-colors duration-[150ms]">
                      {c.ref}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`${base}/counterparties/${String(c.counterparty_id)}`} className="text-sm text-[#94A3B8] hover:text-[#FAFAFA] transition-colors duration-[150ms]">
                      {entityName ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium capitalize ${TYPE_COLOR[c.type] ?? 'text-[#94A3B8]'}`}>{c.type}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#FAFAFA] font-mono text-right">${c.value_usd.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm font-mono">
                    {c.expires_at
                      ? <span className={expired ? 'text-[#EF4444]' : 'text-[#64748B]'}>{new Date(c.expires_at).toLocaleDateString()}</span>
                      : <span className="text-[#475569]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#94A3B8] font-mono text-center">
                    {c.force_majeure_clauses.length > 0
                      ? <span className="text-amber-400">{c.force_majeure_clauses.length}</span>
                      : <span className="text-[#475569]">0</span>}
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

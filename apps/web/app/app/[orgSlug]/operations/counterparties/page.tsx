import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Counterparty, WatchlistEntity } from '@syntra/db';
import type { ICounterparty } from '@syntra/db';

interface PageProps { params: { orgSlug: string }; searchParams: { role?: string } }

function RiskBar({ score }: { score: number }) {
  const color = score >= 70 ? '#EF4444' : score >= 40 ? '#F97316' : '#60A5FA';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-[#262C36] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono" style={{ color }}>{score}</span>
    </div>
  );
}

export default async function CounterpartiesPage({ params, searchParams }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);
  const filter: Record<string, unknown> = { org_id: org._id, active: true };
  if (searchParams.role) filter.role = searchParams.role;

  const cps = await Counterparty.find(filter).sort({ risk_score: -1 }).limit(100).lean() as unknown as ICounterparty[];

  const entityIds = [...new Set(cps.map(c => String(c.entity_id)))];
  const entities = await WatchlistEntity.find({ _id: { $in: entityIds } }).select('name country_code').lean();
  const entityMap = Object.fromEntries(entities.map(e => [String(e._id), e]));

  const base = `/app/${params.orgSlug}/operations`;
  const ROLES = ['supplier', 'customer', 'broker', 'logistics'] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-[#64748B] mb-1">
            <Link href={base} className="hover:text-[#94A3B8] transition-colors duration-[150ms]">Operations</Link>
            <span>/</span>
            <span className="text-[#94A3B8]">Counterparties</span>
          </div>
          <h1 className="text-xl font-semibold text-[#FAFAFA]">Counterparty Risk Center</h1>
          <p className="text-sm text-[#94A3B8] mt-1">{cps.length} counterparties · sorted by risk score</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-[#3B82F6] text-white hover:bg-blue-500 transition-colors duration-[150ms] ease-out active:scale-95">
          <Plus size={14} /> Add counterparty
        </button>
      </div>

      <div className="flex items-center gap-1">
        <Link href={`${base}/counterparties`} className={`px-3 py-1.5 rounded text-xs ${!searchParams.role ? 'bg-[#1E2530] text-[#FAFAFA]' : 'text-[#94A3B8] hover:text-[#FAFAFA]'} transition-colors duration-[150ms]`}>All</Link>
        {ROLES.map(r => (
          <Link key={r} href={`${base}/counterparties?role=${r}`} className={`px-3 py-1.5 rounded text-xs capitalize ${searchParams.role === r ? 'bg-[#1E2530] text-[#FAFAFA]' : 'text-[#94A3B8] hover:text-[#FAFAFA]'} transition-colors duration-[150ms]`}>{r}</Link>
        ))}
      </div>

      <div className="bg-[#151921] border border-[#1E2530] rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1E2530]">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Entity</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Risk Score</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Relationship (USD)</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Contract</th>
            </tr>
          </thead>
          <tbody>
            {cps.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-[#64748B]">No counterparties found.</td></tr>
            ) : cps.map(c => {
              const entity = entityMap[String(c.entity_id)] as { name: string; country_code: string | null } | undefined;
              return (
                <tr key={String(c._id)} className="border-b border-[#1E2530] hover:bg-[#1E2530] transition-colors duration-[150ms]">
                  <td className="px-4 py-3">
                    <Link href={`${base}/counterparties/${String(c._id)}`} className="text-sm font-medium text-[#FAFAFA] hover:text-[#3B82F6] transition-colors duration-[150ms]">
                      {entity?.name ?? '—'}
                    </Link>
                    {entity?.country_code && <span className="ml-2 text-xs text-[#64748B] font-mono">{entity.country_code}</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#94A3B8] capitalize">{c.role}</td>
                  <td className="px-4 py-3"><RiskBar score={c.risk_score} /></td>
                  <td className="px-4 py-3 text-sm text-[#FAFAFA] font-mono text-right">${c.relationship_value_usd.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">
                    {c.contract_id
                      ? <Link href={`${base}/contracts/${String(c.contract_id)}`} className="text-[#3B82F6] font-mono text-xs hover:underline">{String(c.contract_id).slice(-8)}</Link>
                      : <span className="text-[#475569] text-xs">—</span>}
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

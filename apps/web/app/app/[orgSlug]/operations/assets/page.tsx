import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Asset } from '@syntra/db';
import type { IAsset } from '@syntra/db';

interface PageProps { params: { orgSlug: string }; searchParams: { kind?: string; criticality?: string } }

const CRITICALITY_COLOR: Record<string, string> = {
  critical: 'text-[#EF4444]',
  high:     'text-[#F97316]',
  medium:   'text-[#EAB308]',
  low:      'text-[#60A5FA]',
};

const KIND_ICON: Record<string, string> = { facility: '🏭', machinery: '⚙️', inventory: '📦', ip: '💡' };

export default async function AssetsPage({ params, searchParams }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);
  const filter: Record<string, unknown> = { org_id: org._id, active: true };
  if (searchParams.kind) filter.kind = searchParams.kind;
  if (searchParams.criticality) filter.criticality = searchParams.criticality;

  const assets = await Asset.find(filter).sort({ criticality: 1, name: 1 }).lean() as unknown as IAsset[];
  const base = `/app/${params.orgSlug}/operations`;

  const KINDS = ['facility', 'machinery', 'inventory', 'ip'] as const;
  const CRITS = ['critical', 'high', 'medium', 'low'] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-[#64748B] mb-1">
            <Link href={base} className="hover:text-[#94A3B8] transition-colors duration-[150ms]">Operations</Link>
            <span>/</span>
            <span className="text-[#94A3B8]">Assets</span>
          </div>
          <h1 className="text-xl font-semibold text-[#FAFAFA]">Asset Registry</h1>
          <p className="text-sm text-[#94A3B8] mt-1">{assets.length} assets</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-[#3B82F6] text-white hover:bg-blue-500 transition-colors duration-[150ms] ease-out active:scale-95">
          <Plus size={14} /> Add asset
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-xs text-[#64748B] uppercase tracking-wider mr-2">Kind</span>
          <Link href={`${base}/assets`} className={`px-2 py-1 rounded text-xs ${!searchParams.kind ? 'bg-[#1E2530] text-[#FAFAFA]' : 'text-[#94A3B8] hover:text-[#FAFAFA]'} transition-colors duration-[150ms]`}>All</Link>
          {KINDS.map(k => (
            <Link key={k} href={`${base}/assets?kind=${k}`} className={`px-2 py-1 rounded text-xs capitalize ${searchParams.kind === k ? 'bg-[#1E2530] text-[#FAFAFA]' : 'text-[#94A3B8] hover:text-[#FAFAFA]'} transition-colors duration-[150ms]`}>{k}</Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-[#64748B] uppercase tracking-wider mr-2">Criticality</span>
          <Link href={`${base}/assets`} className={`px-2 py-1 rounded text-xs ${!searchParams.criticality ? 'bg-[#1E2530] text-[#FAFAFA]' : 'text-[#94A3B8] hover:text-[#FAFAFA]'} transition-colors duration-[150ms]`}>All</Link>
          {CRITS.map(c => (
            <Link key={c} href={`${base}/assets?criticality=${c}`} className={`px-2 py-1 rounded text-xs capitalize ${searchParams.criticality === c ? 'bg-[#1E2530] text-[#FAFAFA]' : 'text-[#94A3B8] hover:text-[#FAFAFA]'} transition-colors duration-[150ms]`}>{c}</Link>
          ))}
        </div>
      </div>

      <div className="bg-[#151921] border border-[#1E2530] rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1E2530]">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Kind</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Location</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Value (USD)</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Criticality</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-[#64748B]">No assets found.</td></tr>
            ) : assets.map(a => (
              <tr key={String(a._id)} className="border-b border-[#1E2530] hover:bg-[#1E2530] transition-colors duration-[150ms]">
                <td className="px-4 py-3">
                  <Link href={`${base}/assets/${String(a._id)}`} className="text-sm font-medium text-[#FAFAFA] hover:text-[#3B82F6] transition-colors duration-[150ms]">
                    <span className="mr-2">{KIND_ICON[a.kind]}</span>{a.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-[#94A3B8] capitalize">{a.kind}</td>
                <td className="px-4 py-3 text-sm text-[#64748B] font-mono">
                  {a.location_geo ? `${a.location_geo.lat.toFixed(2)}, ${a.location_geo.lng.toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-[#FAFAFA] font-mono text-right">
                  ${a.value_usd.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium capitalize ${CRITICALITY_COLOR[a.criticality] ?? 'text-[#94A3B8]'}`}>{a.criticality}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

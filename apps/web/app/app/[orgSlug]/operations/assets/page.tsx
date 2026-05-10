import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Asset } from '@syntra/db';
import type { IAsset } from '@syntra/db';

interface PageProps { params: { orgSlug: string }; searchParams: { kind?: string; criticality?: string } }

const CRITICALITY_COLOR: Record<string, string> = {
  critical: 'text-severity-critical',
  high:     'text-severity-high',
  medium:   'text-severity-medium',
  low:      'text-severity-low',
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
          <div className="flex items-center gap-2 text-sm text-text-muted mb-1">
            <Link href={base} className="hover:text-text-secondary transition-colors duration-[150ms]">Operations</Link>
            <span>/</span>
            <span className="text-text-secondary">Assets</span>
          </div>
          <h1 className="text-xl font-semibold text-text-primary">Asset Registry</h1>
          <p className="text-sm text-text-secondary mt-1">{assets.length} assets</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95">
          <Plus size={14} /> Add asset
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-muted uppercase tracking-wider mr-2">Kind</span>
          <Link href={`${base}/assets`} className={`px-2 py-1 rounded text-xs ${!searchParams.kind ? 'bg-bg-surface-2 text-text-primary' : 'text-text-secondary hover:text-text-primary'} transition-colors duration-[150ms]`}>All</Link>
          {KINDS.map(k => (
            <Link key={k} href={`${base}/assets?kind=${k}`} className={`px-2 py-1 rounded text-xs capitalize ${searchParams.kind === k ? 'bg-bg-surface-2 text-text-primary' : 'text-text-secondary hover:text-text-primary'} transition-colors duration-[150ms]`}>{k}</Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-muted uppercase tracking-wider mr-2">Criticality</span>
          <Link href={`${base}/assets`} className={`px-2 py-1 rounded text-xs ${!searchParams.criticality ? 'bg-bg-surface-2 text-text-primary' : 'text-text-secondary hover:text-text-primary'} transition-colors duration-[150ms]`}>All</Link>
          {CRITS.map(c => (
            <Link key={c} href={`${base}/assets?criticality=${c}`} className={`px-2 py-1 rounded text-xs capitalize ${searchParams.criticality === c ? 'bg-bg-surface-2 text-text-primary' : 'text-text-secondary hover:text-text-primary'} transition-colors duration-[150ms]`}>{c}</Link>
          ))}
        </div>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Kind</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Location</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">Value (USD)</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Criticality</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-text-muted">No assets found.</td></tr>
            ) : assets.map(a => (
              <tr key={String(a._id)} className="border-b border-border-subtle hover:bg-bg-surface-2 transition-colors duration-[150ms]">
                <td className="px-4 py-3">
                  <Link href={`${base}/assets/${String(a._id)}`} className="text-sm font-medium text-text-primary hover:text-accent transition-colors duration-[150ms]">
                    <span className="mr-2">{KIND_ICON[a.kind]}</span>{a.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary capitalize">{a.kind}</td>
                <td className="px-4 py-3 text-sm text-text-muted font-mono">
                  {a.location_geo ? `${a.location_geo.lat.toFixed(2)}, ${a.location_geo.lng.toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-text-primary font-mono text-right">
                  ${a.value_usd.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium capitalize ${CRITICALITY_COLOR[a.criticality] ?? 'text-text-secondary'}`}>{a.criticality}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

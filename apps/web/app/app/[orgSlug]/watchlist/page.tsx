import { Plus, Upload, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { WatchlistEntity } from '@syntra/db';
import { WorldMap } from '@/components/map/WorldMap';
import { SeverityBadge } from '@syntra/ui/components/SeverityBadge';
import { NLBar } from '@/components/watchlist/NLBar';
import type { IWatchlistEntity } from '@syntra/db';
import type { EntityType } from '@syntra/shared';

interface PageProps {
  params: { orgSlug: string };
  searchParams: { type?: string };
}

const TYPE_LABELS: Record<string, string> = {
  supplier: 'Supplier', port: 'Port', route: 'Route',
  country: 'Country', region: 'Region', asset: 'Asset',
};

const TYPE_ICONS: Record<string, string> = {
  supplier: '🏭', port: '⚓', route: '➡', country: '🏴', region: '🌐', asset: '📦',
};

export default async function WatchlistPage({ params, searchParams }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const allEntities = await WatchlistEntity.find({ org_id: org._id, active: true }).sort({ type: 1, name: 1 }).lean() as unknown as IWatchlistEntity[];

  const filtered = searchParams.type
    ? allEntities.filter(e => e.type === searchParams.type)
    : allEntities;

  const countByType: Record<string, number> = {};
  for (const e of allEntities) {
    countByType[e.type] = (countByType[e.type] ?? 0) + 1;
  }

  const mapPins = allEntities
    .filter(e => e.latitude !== null && e.longitude !== null)
    .map(e => ({ id: String(e._id), lat: e.latitude!, lng: e.longitude!, name: e.name, type: e.type }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Watchlist</h1>
          <p className="text-sm text-text-secondary mt-1">
            {allEntities.length} entities ·{' '}
            {Object.entries(countByType).map(([t, c]) => `${c} ${t}s`).join(' · ')}
          </p>
        </div>
        <Link
          href={`/app/${params.orgSlug}/watchlist/add`}
          className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95"
        >
          <Plus size={14} />
          Add entity
        </Link>
      </div>

      {/* Type tabs */}
      <div className="flex items-center gap-0 border-b border-border-subtle">
        {[{ label: 'All', count: allEntities.length, value: '' }, ...Object.entries(countByType).map(([t, c]) => ({ label: TYPE_LABELS[t] ?? t, count: c, value: t }))].map(tab => (
          <Link
            key={tab.value}
            href={tab.value ? `/app/${params.orgSlug}/watchlist?type=${tab.value}` : `/app/${params.orgSlug}/watchlist`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-[150ms] ease-out -mb-px ${
              (tab.value === '' && !searchParams.type) || tab.value === searchParams.type
                ? 'border-accent text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label} <span className="text-text-muted ml-1 font-mono text-xs">{tab.count}</span>
          </Link>
        ))}
      </div>

      {/* Mini map */}
      <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden" style={{ height: 280 }}>
        <WorldMap watchlistPins={mapPins} height="280px" />
      </div>

      {/* NL watchlist bar */}
      <NLBar orgSlug={params.orgSlug} />

      {/* Search + import */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 h-8 rounded-md bg-bg-surface-2 border border-border-default w-72">
          <span className="text-text-muted text-sm">🔍</span>
          <span className="text-sm text-text-muted">Search entities...</span>
        </div>
        <button className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-bg-surface-2 border border-border-default text-text-secondary hover:text-text-primary hover:bg-bg-surface-3 transition-colors duration-[150ms] ease-out active:scale-95">
          <Upload size={14} />
          Bulk import CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Location</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-text-muted">No entities found.</td>
              </tr>
            ) : (
              filtered.map(entity => (
                <tr key={String(entity._id)} className="border-b border-border-subtle hover:bg-bg-surface-2 transition-colors duration-[150ms]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                      <span className="text-text-muted">{TYPE_ICONS[entity.type] ?? '•'}</span>
                      {entity.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary capitalize">{entity.type}</td>
                  <td className="px-4 py-3 text-sm text-text-muted font-mono">
                    {entity.latitude !== null && entity.longitude !== null
                      ? `${entity.latitude.toFixed(2)}, ${entity.longitude.toFixed(2)}`
                      : entity.country_code ?? entity.region ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block w-2 h-2 rounded-full ${entity.active ? 'bg-green-500' : 'bg-text-disabled'}`} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-surface-3 transition-colors duration-[150ms]">
                      <MoreHorizontal size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

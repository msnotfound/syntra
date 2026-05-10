import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Shipment, WatchlistEntity } from '@syntra/db';
import type { IShipment } from '@syntra/db';

interface PageProps { params: { orgSlug: string }; searchParams: { status?: string } }

const STATUS_COLOR: Record<string, string> = {
  draft:      'text-text-muted',
  in_transit: 'text-severity-low',
  delivered:  'text-emerald-400',
  cancelled:  'text-severity-critical',
};

export default async function ShipmentsPage({ params, searchParams }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);
  const filter: Record<string, unknown> = { org_id: org._id, active: true };
  if (searchParams.status) filter.status = searchParams.status;

  const shipments = await Shipment.find(filter).sort({ created_at: -1 }).limit(100).lean() as unknown as IShipment[];

  // Batch-fetch entity names for origin/destination
  const entityIds = [...new Set(shipments.flatMap(s => [String(s.origin_entity_id), String(s.destination_entity_id)]))];
  const entities = await WatchlistEntity.find({ _id: { $in: entityIds } }).select('name type').lean();
  const entityMap = Object.fromEntries(entities.map(e => [String(e._id), e.name]));

  const base = `/app/${params.orgSlug}/operations`;
  const STATUSES = ['draft', 'in_transit', 'delivered', 'cancelled'] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-text-muted mb-1">
            <Link href={base} className="hover:text-text-secondary transition-colors duration-[150ms]">Operations</Link>
            <span>/</span>
            <span className="text-text-secondary">Shipments</span>
          </div>
          <h1 className="text-xl font-semibold text-text-primary">Shipments</h1>
          <p className="text-sm text-text-secondary mt-1">{shipments.length} shipments</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95">
          <Plus size={14} /> Add shipment
        </button>
      </div>

      <div className="flex items-center gap-1">
        <Link href={`${base}/shipments`} className={`px-3 py-1.5 rounded text-xs ${!searchParams.status ? 'bg-bg-surface-2 text-text-primary' : 'text-text-secondary hover:text-text-primary'} transition-colors duration-[150ms]`}>All</Link>
        {STATUSES.map(s => (
          <Link key={s} href={`${base}/shipments?status=${s}`} className={`px-3 py-1.5 rounded text-xs ${searchParams.status === s ? 'bg-bg-surface-2 text-text-primary' : 'text-text-secondary hover:text-text-primary'} transition-colors duration-[150ms]`}>
            {s.replace('_', ' ')}
          </Link>
        ))}
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Ref</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Origin</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Destination</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">Value (USD)</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">ETA</th>
            </tr>
          </thead>
          <tbody>
            {shipments.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-text-muted">No shipments found.</td></tr>
            ) : shipments.map(s => (
              <tr key={String(s._id)} className="border-b border-border-subtle hover:bg-bg-surface-2 transition-colors duration-[150ms]">
                <td className="px-4 py-3">
                  <Link href={`${base}/shipments/${String(s._id)}`} className="text-sm font-medium text-text-primary font-mono hover:text-accent transition-colors duration-[150ms]">
                    {s.ref}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary">{entityMap[String(s.origin_entity_id)] ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-text-secondary">{entityMap[String(s.destination_entity_id)] ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium capitalize ${STATUS_COLOR[s.status] ?? 'text-text-secondary'}`}>{s.status.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-3 text-sm text-text-primary font-mono text-right">${s.value_usd.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-text-muted font-mono">
                  {s.eta_at ? new Date(s.eta_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

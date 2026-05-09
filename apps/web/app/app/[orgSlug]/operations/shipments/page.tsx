import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Shipment, WatchlistEntity } from '@syntra/db';
import type { IShipment } from '@syntra/db';

interface PageProps { params: { orgSlug: string }; searchParams: { status?: string } }

const STATUS_COLOR: Record<string, string> = {
  draft:      'text-[#64748B]',
  in_transit: 'text-[#60A5FA]',
  delivered:  'text-emerald-400',
  cancelled:  'text-[#EF4444]',
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
          <div className="flex items-center gap-2 text-sm text-[#64748B] mb-1">
            <Link href={base} className="hover:text-[#94A3B8] transition-colors duration-[150ms]">Operations</Link>
            <span>/</span>
            <span className="text-[#94A3B8]">Shipments</span>
          </div>
          <h1 className="text-xl font-semibold text-[#FAFAFA]">Shipments</h1>
          <p className="text-sm text-[#94A3B8] mt-1">{shipments.length} shipments</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-[#3B82F6] text-white hover:bg-blue-500 transition-colors duration-[150ms] ease-out active:scale-95">
          <Plus size={14} /> Add shipment
        </button>
      </div>

      <div className="flex items-center gap-1">
        <Link href={`${base}/shipments`} className={`px-3 py-1.5 rounded text-xs ${!searchParams.status ? 'bg-[#1E2530] text-[#FAFAFA]' : 'text-[#94A3B8] hover:text-[#FAFAFA]'} transition-colors duration-[150ms]`}>All</Link>
        {STATUSES.map(s => (
          <Link key={s} href={`${base}/shipments?status=${s}`} className={`px-3 py-1.5 rounded text-xs ${searchParams.status === s ? 'bg-[#1E2530] text-[#FAFAFA]' : 'text-[#94A3B8] hover:text-[#FAFAFA]'} transition-colors duration-[150ms]`}>
            {s.replace('_', ' ')}
          </Link>
        ))}
      </div>

      <div className="bg-[#151921] border border-[#1E2530] rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1E2530]">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Ref</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Origin</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Destination</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Value (USD)</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">ETA</th>
            </tr>
          </thead>
          <tbody>
            {shipments.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[#64748B]">No shipments found.</td></tr>
            ) : shipments.map(s => (
              <tr key={String(s._id)} className="border-b border-[#1E2530] hover:bg-[#1E2530] transition-colors duration-[150ms]">
                <td className="px-4 py-3">
                  <Link href={`${base}/shipments/${String(s._id)}`} className="text-sm font-medium text-[#FAFAFA] font-mono hover:text-[#3B82F6] transition-colors duration-[150ms]">
                    {s.ref}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-[#94A3B8]">{entityMap[String(s.origin_entity_id)] ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-[#94A3B8]">{entityMap[String(s.destination_entity_id)] ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium capitalize ${STATUS_COLOR[s.status] ?? 'text-[#94A3B8]'}`}>{s.status.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-3 text-sm text-[#FAFAFA] font-mono text-right">${s.value_usd.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-[#64748B] font-mono">
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

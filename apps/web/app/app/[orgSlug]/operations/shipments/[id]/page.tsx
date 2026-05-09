import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Shipment, WatchlistEntity, PurchaseOrder } from '@syntra/db';
import type { IShipment, IPurchaseOrder } from '@syntra/db';

interface PageProps { params: { orgSlug: string; id: string } }

const STATUS_COLOR: Record<string, string> = {
  draft:      'text-[#64748B] bg-[#64748B]/10',
  in_transit: 'text-[#60A5FA] bg-[#60A5FA]/10',
  delivered:  'text-emerald-400 bg-emerald-400/10',
  cancelled:  'text-[#EF4444] bg-[#EF4444]/10',
};

export default async function ShipmentDetailPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);
  const shipment = await Shipment.findOne({ _id: params.id, org_id: org._id }).lean() as unknown as IShipment | null;
  if (!shipment) notFound();

  const [origin, destination, relatedPOs] = await Promise.all([
    WatchlistEntity.findById(shipment.origin_entity_id).lean(),
    WatchlistEntity.findById(shipment.destination_entity_id).lean(),
    PurchaseOrder.find({ org_id: org._id, supplier_entity_id: shipment.origin_entity_id, active: true }).limit(10).lean() as Promise<unknown[]>,
  ]);

  const base = `/app/${params.orgSlug}/operations`;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-[#64748B] mb-1">
          <Link href={base} className="hover:text-[#94A3B8] transition-colors duration-[150ms]">Operations</Link>
          <span>/</span>
          <Link href={`${base}/shipments`} className="hover:text-[#94A3B8] transition-colors duration-[150ms]">Shipments</Link>
          <span>/</span>
          <span className="text-[#94A3B8] font-mono">{shipment.ref}</span>
        </div>
        <div className="flex items-start justify-between">
          <h1 className="text-xl font-semibold text-[#FAFAFA] font-mono">{shipment.ref}</h1>
          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLOR[shipment.status] ?? 'text-[#94A3B8]'}`}>
            {shipment.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="bg-[#151921] border border-[#1E2530] rounded-md divide-y divide-[#1E2530]">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-[#64748B]">Origin</span>
          {origin
            ? <Link href={`/app/${params.orgSlug}/watchlist`} className="text-sm text-[#3B82F6] hover:underline">{(origin as { name: string }).name}</Link>
            : <span className="text-sm text-[#64748B] font-mono">{String(shipment.origin_entity_id)}</span>}
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-[#64748B]">Destination</span>
          {destination
            ? <Link href={`/app/${params.orgSlug}/watchlist`} className="text-sm text-[#3B82F6] hover:underline">{(destination as { name: string }).name}</Link>
            : <span className="text-sm text-[#64748B] font-mono">{String(shipment.destination_entity_id)}</span>}
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-[#64748B]">Value (USD)</span>
          <span className="text-sm text-[#FAFAFA] font-mono">${shipment.value_usd.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-[#64748B]">ETA</span>
          <span className="text-sm text-[#FAFAFA] font-mono">{shipment.eta_at ? new Date(shipment.eta_at).toISOString() : '—'}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-[#64748B]">Route waypoints</span>
          <span className="text-sm text-[#94A3B8] font-mono">{shipment.route_polyline.length}</span>
        </div>
      </div>

      {/* Cross-link: related POs from origin supplier */}
      <div>
        <h2 className="text-sm font-semibold text-[#FAFAFA] mb-2">Purchase orders from this supplier</h2>
        {(relatedPOs as IPurchaseOrder[]).length === 0 ? (
          <p className="text-sm text-[#64748B]">No purchase orders linked.</p>
        ) : (
          <div className="bg-[#151921] border border-[#1E2530] rounded-md divide-y divide-[#1E2530]">
            {(relatedPOs as IPurchaseOrder[]).map(po => (
              <div key={String(po._id)} className="flex items-center justify-between px-4 py-3">
                <Link href={`${base}/purchase-orders/${String(po._id)}`} className="text-sm font-mono text-[#3B82F6] hover:underline">{po.po_number}</Link>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#94A3B8] capitalize">{po.status}</span>
                  <span className="text-sm font-mono text-[#FAFAFA]">${po.total_usd.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

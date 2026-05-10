import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Shipment, WatchlistEntity, PurchaseOrder } from '@syntra/db';
import type { IShipment, IPurchaseOrder } from '@syntra/db';

interface PageProps { params: { orgSlug: string; id: string } }

const STATUS_COLOR: Record<string, string> = {
  draft:      'text-text-muted bg-text-muted/10',
  in_transit: 'text-severity-low bg-severity-low/10',
  delivered:  'text-emerald-400 bg-emerald-400/10',
  cancelled:  'text-severity-critical bg-severity-critical/10',
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
        <div className="flex items-center gap-2 text-sm text-text-muted mb-1">
          <Link href={base} className="hover:text-text-secondary transition-colors duration-[150ms]">Operations</Link>
          <span>/</span>
          <Link href={`${base}/shipments`} className="hover:text-text-secondary transition-colors duration-[150ms]">Shipments</Link>
          <span>/</span>
          <span className="text-text-secondary font-mono">{shipment.ref}</span>
        </div>
        <div className="flex items-start justify-between">
          <h1 className="text-xl font-semibold text-text-primary font-mono">{shipment.ref}</h1>
          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLOR[shipment.status] ?? 'text-text-secondary'}`}>
            {shipment.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-md divide-y divide-border-subtle">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-text-muted">Origin</span>
          {origin
            ? <Link href={`/app/${params.orgSlug}/watchlist`} className="text-sm text-accent hover:underline">{(origin as { name: string }).name}</Link>
            : <span className="text-sm text-text-muted font-mono">{String(shipment.origin_entity_id)}</span>}
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-text-muted">Destination</span>
          {destination
            ? <Link href={`/app/${params.orgSlug}/watchlist`} className="text-sm text-accent hover:underline">{(destination as { name: string }).name}</Link>
            : <span className="text-sm text-text-muted font-mono">{String(shipment.destination_entity_id)}</span>}
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-text-muted">Value (USD)</span>
          <span className="text-sm text-text-primary font-mono">${shipment.value_usd.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-text-muted">ETA</span>
          <span className="text-sm text-text-primary font-mono">{shipment.eta_at ? new Date(shipment.eta_at).toISOString() : '—'}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-text-muted">Route waypoints</span>
          <span className="text-sm text-text-secondary font-mono">{shipment.route_polyline.length}</span>
        </div>
      </div>

      {/* Cross-link: related POs from origin supplier */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-2">Purchase orders from this supplier</h2>
        {(relatedPOs as IPurchaseOrder[]).length === 0 ? (
          <p className="text-sm text-text-muted">No purchase orders linked.</p>
        ) : (
          <div className="bg-bg-surface border border-border-subtle rounded-md divide-y divide-border-subtle">
            {(relatedPOs as IPurchaseOrder[]).map(po => (
              <div key={String(po._id)} className="flex items-center justify-between px-4 py-3">
                <Link href={`${base}/purchase-orders/${String(po._id)}`} className="text-sm font-mono text-accent hover:underline">{po.po_number}</Link>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-secondary capitalize">{po.status}</span>
                  <span className="text-sm font-mono text-text-primary">${po.total_usd.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

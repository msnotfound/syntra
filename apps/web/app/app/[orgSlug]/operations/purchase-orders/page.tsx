import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { PurchaseOrder, WatchlistEntity } from '@syntra/db';
import type { IPurchaseOrder } from '@syntra/db';

interface PageProps { params: { orgSlug: string }; searchParams: { status?: string } }

const STATUS_COLOR: Record<string, string> = {
  draft:     'text-text-muted',
  approved:  'text-severity-low',
  shipped:   'text-amber-400',
  received:  'text-emerald-400',
  cancelled: 'text-severity-critical',
};

export default async function PurchaseOrdersPage({ params, searchParams }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);
  const filter: Record<string, unknown> = { org_id: org._id, active: true };
  if (searchParams.status) filter.status = searchParams.status;

  const pos = await PurchaseOrder.find(filter).sort({ created_at: -1 }).limit(100).lean() as unknown as IPurchaseOrder[];

  const supplierIds = [...new Set(pos.map(p => String(p.supplier_entity_id)))];
  const suppliers = await WatchlistEntity.find({ _id: { $in: supplierIds } }).select('name').lean();
  const supplierMap = Object.fromEntries(suppliers.map(s => [String(s._id), s.name]));

  const base = `/app/${params.orgSlug}/operations`;
  const STATUSES = ['draft', 'approved', 'shipped', 'received', 'cancelled'] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-text-muted mb-1">
            <Link href={base} className="hover:text-text-secondary transition-colors duration-[150ms]">Operations</Link>
            <span>/</span>
            <span className="text-text-secondary">Purchase Orders</span>
          </div>
          <h1 className="text-xl font-semibold text-text-primary">Purchase Orders</h1>
          <p className="text-sm text-text-secondary mt-1">{pos.length} orders</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95">
          <Plus size={14} /> New PO
        </button>
      </div>

      <div className="flex items-center gap-1">
        <Link href={`${base}/purchase-orders`} className={`px-3 py-1.5 rounded text-xs ${!searchParams.status ? 'bg-bg-surface-2 text-text-primary' : 'text-text-secondary hover:text-text-primary'} transition-colors duration-[150ms]`}>All</Link>
        {STATUSES.map(s => (
          <Link key={s} href={`${base}/purchase-orders?status=${s}`} className={`px-3 py-1.5 rounded text-xs capitalize ${searchParams.status === s ? 'bg-bg-surface-2 text-text-primary' : 'text-text-secondary hover:text-text-primary'} transition-colors duration-[150ms]`}>{s}</Link>
        ))}
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">PO Number</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Supplier</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-text-secondary">Items</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">Total (USD)</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Due</th>
            </tr>
          </thead>
          <tbody>
            {pos.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-text-muted">No purchase orders found.</td></tr>
            ) : pos.map(p => (
              <tr key={String(p._id)} className="border-b border-border-subtle hover:bg-bg-surface-2 transition-colors duration-[150ms]">
                <td className="px-4 py-3">
                  <Link href={`${base}/purchase-orders/${String(p._id)}`} className="text-sm font-medium text-text-primary font-mono hover:text-accent transition-colors duration-[150ms]">
                    {p.po_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-text-secondary">{supplierMap[String(p.supplier_entity_id)] ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-text-secondary font-mono text-center">{p.items.length}</td>
                <td className="px-4 py-3 text-sm text-text-primary font-mono text-right">${p.total_usd.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium capitalize ${STATUS_COLOR[p.status] ?? 'text-text-secondary'}`}>{p.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-text-muted font-mono">
                  {p.due_at ? new Date(p.due_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

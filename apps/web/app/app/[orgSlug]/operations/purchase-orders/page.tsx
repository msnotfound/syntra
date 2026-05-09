import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { PurchaseOrder, WatchlistEntity } from '@syntra/db';
import type { IPurchaseOrder } from '@syntra/db';

interface PageProps { params: { orgSlug: string }; searchParams: { status?: string } }

const STATUS_COLOR: Record<string, string> = {
  draft:     'text-[#64748B]',
  approved:  'text-[#60A5FA]',
  shipped:   'text-amber-400',
  received:  'text-emerald-400',
  cancelled: 'text-[#EF4444]',
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
          <div className="flex items-center gap-2 text-sm text-[#64748B] mb-1">
            <Link href={base} className="hover:text-[#94A3B8] transition-colors duration-[150ms]">Operations</Link>
            <span>/</span>
            <span className="text-[#94A3B8]">Purchase Orders</span>
          </div>
          <h1 className="text-xl font-semibold text-[#FAFAFA]">Purchase Orders</h1>
          <p className="text-sm text-[#94A3B8] mt-1">{pos.length} orders</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-[#3B82F6] text-white hover:bg-blue-500 transition-colors duration-[150ms] ease-out active:scale-95">
          <Plus size={14} /> New PO
        </button>
      </div>

      <div className="flex items-center gap-1">
        <Link href={`${base}/purchase-orders`} className={`px-3 py-1.5 rounded text-xs ${!searchParams.status ? 'bg-[#1E2530] text-[#FAFAFA]' : 'text-[#94A3B8] hover:text-[#FAFAFA]'} transition-colors duration-[150ms]`}>All</Link>
        {STATUSES.map(s => (
          <Link key={s} href={`${base}/purchase-orders?status=${s}`} className={`px-3 py-1.5 rounded text-xs capitalize ${searchParams.status === s ? 'bg-[#1E2530] text-[#FAFAFA]' : 'text-[#94A3B8] hover:text-[#FAFAFA]'} transition-colors duration-[150ms]`}>{s}</Link>
        ))}
      </div>

      <div className="bg-[#151921] border border-[#1E2530] rounded-md overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1E2530]">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">PO Number</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Supplier</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Items</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Total (USD)</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Due</th>
            </tr>
          </thead>
          <tbody>
            {pos.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[#64748B]">No purchase orders found.</td></tr>
            ) : pos.map(p => (
              <tr key={String(p._id)} className="border-b border-[#1E2530] hover:bg-[#1E2530] transition-colors duration-[150ms]">
                <td className="px-4 py-3">
                  <Link href={`${base}/purchase-orders/${String(p._id)}`} className="text-sm font-medium text-[#FAFAFA] font-mono hover:text-[#3B82F6] transition-colors duration-[150ms]">
                    {p.po_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-[#94A3B8]">{supplierMap[String(p.supplier_entity_id)] ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-[#94A3B8] font-mono text-center">{p.items.length}</td>
                <td className="px-4 py-3 text-sm text-[#FAFAFA] font-mono text-right">${p.total_usd.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium capitalize ${STATUS_COLOR[p.status] ?? 'text-[#94A3B8]'}`}>{p.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-[#64748B] font-mono">
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

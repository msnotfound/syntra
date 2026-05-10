import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { PurchaseOrder, Counterparty, WatchlistEntity } from '@syntra/db';
import type { IPurchaseOrder, ICounterparty } from '@syntra/db';

interface PageProps { params: { orgSlug: string; id: string } }

const STATUS_COLOR: Record<string, string> = {
  draft:     'text-text-muted bg-text-muted/10',
  approved:  'text-severity-low bg-severity-low/10',
  shipped:   'text-amber-400 bg-amber-400/10',
  received:  'text-emerald-400 bg-emerald-400/10',
  cancelled: 'text-severity-critical bg-severity-critical/10',
};

export default async function PurchaseOrderDetailPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);
  const po = await PurchaseOrder.findOne({ _id: params.id, org_id: org._id }).lean() as unknown as IPurchaseOrder | null;
  if (!po) notFound();

  const [supplier, counterparty] = await Promise.all([
    WatchlistEntity.findById(po.supplier_entity_id).lean(),
    Counterparty.findOne({ org_id: org._id, entity_id: po.supplier_entity_id, active: true }).lean() as Promise<ICounterparty | null>,
  ]);

  const base = `/app/${params.orgSlug}/operations`;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-text-muted mb-1">
          <Link href={base} className="hover:text-text-secondary transition-colors duration-[150ms]">Operations</Link>
          <span>/</span>
          <Link href={`${base}/purchase-orders`} className="hover:text-text-secondary transition-colors duration-[150ms]">Purchase Orders</Link>
          <span>/</span>
          <span className="text-text-secondary font-mono">{po.po_number}</span>
        </div>
        <div className="flex items-start justify-between">
          <h1 className="text-xl font-semibold text-text-primary font-mono">{po.po_number}</h1>
          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLOR[po.status] ?? 'text-text-secondary'}`}>{po.status}</span>
        </div>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-md divide-y divide-border-subtle">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-text-muted">Supplier</span>
          {supplier
            ? <Link href={`/app/${params.orgSlug}/watchlist`} className="text-sm text-accent hover:underline">{(supplier as { name: string }).name}</Link>
            : <span className="text-sm text-text-muted font-mono">{String(po.supplier_entity_id)}</span>}
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-text-muted">Total (USD)</span>
          <span className="text-sm text-text-primary font-mono">${po.total_usd.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-text-muted">Due</span>
          <span className="text-sm text-text-primary font-mono">{po.due_at ? new Date(po.due_at).toISOString() : '—'}</span>
        </div>
      </div>

      {/* Line items */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-2">Line items</h2>
        <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-4 py-2 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Description</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Qty</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Unit price</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {po.items.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-text-muted">No line items.</td></tr>
              ) : po.items.map((item, i) => (
                <tr key={i} className="border-b border-border-subtle">
                  <td className="px-4 py-2 text-sm text-text-secondary">{item.description}</td>
                  <td className="px-4 py-2 text-sm font-mono text-text-secondary text-right">{item.qty}</td>
                  <td className="px-4 py-2 text-sm font-mono text-text-secondary text-right">${item.unit_price_usd.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm font-mono text-text-primary text-right">${(item.qty * item.unit_price_usd).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cross-link: Counterparty */}
      {counterparty && (
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-2">Counterparty record</h2>
          <Link href={`${base}/counterparties/${String(counterparty._id)}`} className="flex items-center justify-between bg-bg-surface border border-border-subtle rounded-md px-4 py-3 hover:bg-bg-surface-2 transition-colors duration-[150ms]">
            <span className="text-sm text-text-secondary capitalize">{counterparty.role}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-muted">Risk score</span>
              <span className={`text-sm font-mono ${counterparty.risk_score >= 70 ? 'text-severity-critical' : counterparty.risk_score >= 40 ? 'text-severity-high' : 'text-severity-low'}`}>{counterparty.risk_score}</span>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}

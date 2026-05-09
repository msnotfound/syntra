import Link from 'next/link';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Asset, Shipment, PurchaseOrder, Counterparty, Contract } from '@syntra/db';
import { Package, Anchor, FileText, Users, ScrollText } from 'lucide-react';

interface PageProps { params: { orgSlug: string } }

export default async function OperationsPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);
  const orgId = org._id;

  const [assetCount, shipmentCount, poCount, cpCount, contractCount] = await Promise.all([
    Asset.countDocuments({ org_id: orgId, active: true }),
    Shipment.countDocuments({ org_id: orgId, active: true }),
    PurchaseOrder.countDocuments({ org_id: orgId, active: true }),
    Counterparty.countDocuments({ org_id: orgId, active: true }),
    Contract.countDocuments({ org_id: orgId, active: true }),
  ]);

  const [inTransit, criticalAssets, highRiskCPs] = await Promise.all([
    Shipment.countDocuments({ org_id: orgId, active: true, status: 'in_transit' }),
    Asset.countDocuments({ org_id: orgId, active: true, criticality: 'critical' }),
    Counterparty.countDocuments({ org_id: orgId, active: true, risk_score: { $gte: 70 } }),
  ]);

  const base = `/app/${params.orgSlug}/operations`;

  const cards = [
    { label: 'Assets', count: assetCount, sub: `${criticalAssets} critical`, href: `${base}/assets`, icon: Package, color: 'text-blue-400' },
    { label: 'Shipments', count: shipmentCount, sub: `${inTransit} in transit`, href: `${base}/shipments`, icon: Anchor, color: 'text-emerald-400' },
    { label: 'Purchase Orders', count: poCount, sub: 'Active POs', href: `${base}/purchase-orders`, icon: FileText, color: 'text-amber-400' },
    { label: 'Counterparties', count: cpCount, sub: `${highRiskCPs} high risk`, href: `${base}/counterparties`, icon: Users, color: 'text-rose-400' },
    { label: 'Contracts', count: contractCount, sub: 'Active contracts', href: `${base}/contracts`, icon: ScrollText, color: 'text-purple-400' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#FAFAFA]">Operations</h1>
        <p className="text-sm text-[#94A3B8] mt-1">Operational data layer — assets, shipments, orders, counterparties, contracts.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="bg-[#151921] border border-[#1E2530] rounded-md p-5 hover:bg-[#1E2530] transition-colors duration-[150ms] ease-out active:scale-95 group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-[#64748B]">{card.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-[#FAFAFA] font-mono">{card.count}</p>
                  <p className="mt-1 text-sm text-[#94A3B8]">{card.sub}</p>
                </div>
                <Icon size={20} className={`${card.color} opacity-70 group-hover:opacity-100 transition-opacity duration-[150ms]`} />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="bg-[#151921] border border-[#1E2530] rounded-md p-4">
        <h2 className="text-sm font-semibold text-[#FAFAFA] mb-3">Quick navigation</h2>
        <div className="grid grid-cols-2 gap-2">
          {cards.map(card => (
            <Link
              key={card.href}
              href={card.href}
              className="flex items-center gap-2 px-3 py-2 rounded text-sm text-[#94A3B8] hover:bg-[#1E2530] hover:text-[#FAFAFA] transition-colors duration-[150ms] ease-out"
            >
              <card.icon size={14} className={card.color} />
              {card.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

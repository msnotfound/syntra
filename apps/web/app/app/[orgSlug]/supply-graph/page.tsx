import Link from 'next/link';
import { Upload } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { SupplierLink, WatchlistEntity, Exposure } from '@syntra/db';
import type { IWatchlistEntity } from '@syntra/db';
import { bfsGraph } from '@/lib/supplier-graph/bfs';
import SupplyGraphClient from './SupplyGraphClient';
import type { GraphNodeData, GraphEdgeData } from '@/components/graph/SupplierGraph';

interface PageProps {
  params: { orgSlug: string };
  searchParams: { entityId?: string };
}

export default async function SupplyGraphPage({ params, searchParams }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  // Load all supplier entities
  const allEntities = await WatchlistEntity.find({
    org_id: org._id,
    active: true,
    type: 'supplier',
  }).lean() as unknown as IWatchlistEntity[];

  const entityOptions = allEntities.map(e => ({
    id: String(e._id),
    name: e.name,
    type: e.type,
  }));

  // Pick root entity
  const rootEntityId = searchParams.entityId ?? entityOptions[0]?.id ?? '';

  if (!rootEntityId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Supply Graph</h1>
          <p className="text-sm text-text-secondary mt-1">No supplier entities found. Add suppliers to your watchlist first.</p>
        </div>
        <Link
          href={`/app/${params.orgSlug}/watchlist`}
          className="text-sm text-accent hover:text-accent transition-colors"
        >
          Go to Watchlist →
        </Link>
      </div>
    );
  }

  // BFS over all links
  const allLinks = await SupplierLink.find({ org_id: org._id }).lean();
  const { nodeIds, edges: rawEdges } = bfsGraph(rootEntityId, allLinks);

  const entityDocs = await WatchlistEntity.find({
    _id: { $in: Array.from(nodeIds) },
    org_id: org._id,
  }).lean() as unknown as IWatchlistEntity[];

  // VaR exposures
  const exposures = await Exposure.aggregate([
    { $match: { org_id: org._id, entity_id: { $in: entityDocs.map(e => e._id) } } },
    { $sort: { computed_at: -1 } },
    { $group: { _id: '$entity_id', var_value_usd: { $first: '$var_value_usd' }, var_value_inr: { $first: '$var_value_inr' } } },
  ]);
  const varByEntity = new Map<string, { var_value_usd: number; var_value_inr: number }>();
  for (const e of exposures) {
    varByEntity.set(String(e._id), { var_value_usd: e.var_value_usd, var_value_inr: e.var_value_inr });
  }

  const nodes: GraphNodeData[] = entityDocs.map(e => ({
    id: String(e._id),
    name: e.name,
    type: e.type,
    country_code: e.country_code,
    supplier_tier: e.supplier_tier ?? null,
    var_value_usd: varByEntity.get(String(e._id))?.var_value_usd ?? null,
    is_root: String(e._id) === rootEntityId,
  }));

  const edges: GraphEdgeData[] = rawEdges.map(e => ({
    id: e.id,
    parent_id: e.parent_id,
    child_id: e.child_id,
    tier_offset: e.tier_offset,
    source: e.source,
  }));

  const tierCounts = [1, 2, 3].map(t => nodes.filter(n => n.supplier_tier === t).length);

  return (
    <div className="space-y-4" style={{ height: 'calc(100vh - 140px)' }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Supply Graph</h1>
          <p className="text-sm text-text-secondary mt-1">
            Tier-1: {tierCounts[0]} · Tier-2: {tierCounts[1]} · Tier-3: {tierCounts[2]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/app/${params.orgSlug}/supply-graph/import`}
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-bg-surface-2 border border-border-default text-text-secondary hover:text-text-primary hover:bg-bg-surface-3 transition-colors duration-[150ms] ease-out active:scale-95"
          >
            <Upload size={14} />
            Import CSV
          </Link>
        </div>
      </div>

      {/* Graph */}
      <div style={{ flex: 1, minHeight: 560 }}>
        <SupplyGraphClient
          nodes={nodes}
          edges={edges}
          orgSlug={params.orgSlug}
          rootEntityId={rootEntityId}
          entityOptions={entityOptions}
        />
      </div>
    </div>
  );
}

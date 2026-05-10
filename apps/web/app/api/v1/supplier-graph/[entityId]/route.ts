import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { SupplierLink, WatchlistEntity, Exposure } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { bfsGraph } from '@/lib/supplier-graph/bfs';

interface RouteContext { params: { entityId: string } }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();

  const root = await WatchlistEntity.findOne({
    _id: params.entityId,
    org_id: auth.orgId,
  }).lean();

  if (!root) {
    return NextResponse.json(apiError('NOT_FOUND', 'Entity not found'), { status: 404 });
  }

  // Load all supplier links for this org (graph is org-scoped)
  const allLinks = await SupplierLink.find({ org_id: auth.orgId }).lean();

  const { nodeIds, edges } = bfsGraph(params.entityId, allLinks);

  // Hydrate node entities
  const entityDocs = await WatchlistEntity.find({
    _id: { $in: Array.from(nodeIds) },
    org_id: auth.orgId,
  }).lean();

  // Fetch latest VaR exposure per entity
  const exposures = await Exposure.aggregate([
    { $match: { org_id: root.org_id, entity_id: { $in: entityDocs.map(e => e._id) } } },
    { $sort: { computed_at: -1 } },
    { $group: { _id: '$entity_id', var_value_usd: { $first: '$var_value_usd' }, var_value_inr: { $first: '$var_value_inr' } } },
  ]);
  const varByEntity = new Map<string, { var_value_usd: number; var_value_inr: number }>();
  for (const e of exposures) {
    varByEntity.set(String(e._id), { var_value_usd: e.var_value_usd, var_value_inr: e.var_value_inr });
  }

  const nodes = entityDocs.map(e => ({
    id: String(e._id),
    name: e.name,
    type: e.type,
    country_code: e.country_code,
    region: e.region,
    latitude: e.latitude,
    longitude: e.longitude,
    supplier_tier: e.supplier_tier ?? null,
    var_value_usd: varByEntity.get(String(e._id))?.var_value_usd ?? null,
    var_value_inr: varByEntity.get(String(e._id))?.var_value_inr ?? null,
    is_root: String(e._id) === params.entityId,
  }));

  return NextResponse.json(apiResponse({
    root_entity_id: params.entityId,
    nodes,
    edges: edges.map(e => ({
      id: e.id,
      parent_id: e.parent_id,
      child_id: e.child_id,
      tier_offset: e.tier_offset,
      source: e.source,
      confidence_pct: e.confidence_pct,
    })),
    node_count: nodes.length,
    edge_count: edges.length,
  }));
}

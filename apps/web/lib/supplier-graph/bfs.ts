import type { Types } from 'mongoose';

export interface GraphNode {
  id: string;
  entity_id: string;
  depth: number;
}

export interface GraphEdge {
  id: string;
  parent_id: string;
  child_id: string;
  tier_offset: number;
  source: string;
  confidence_pct: number;
}

export interface LinkRecord {
  _id: Types.ObjectId | string;
  parent_entity_id: Types.ObjectId | string;
  child_entity_id: Types.ObjectId | string;
  tier_offset: number;
  source: string;
  confidence_pct?: number;
}

const MAX_DEPTH = 3;

/**
 * BFS over SupplierLink edges rooted at rootId.
 * Traverses both downstream (parent→child) and upstream (child→parent).
 * Returns deduplicated node list and edge list, depth-limited to 3.
 */
export function bfsGraph(rootId: string, links: LinkRecord[]): {
  nodeIds: Set<string>;
  edges: GraphEdge[];
} {
  const nodeIds = new Set<string>([rootId]);
  const edges: GraphEdge[] = [];
  const edgeSeen = new Set<string>();

  // Build adjacency maps: parentId → children, childId → parents
  const childrenOf = new Map<string, LinkRecord[]>();
  const parentsOf  = new Map<string, LinkRecord[]>();

  for (const link of links) {
    const p = String(link.parent_entity_id);
    const c = String(link.child_entity_id);
    if (!childrenOf.has(p)) childrenOf.set(p, []);
    childrenOf.get(p)!.push(link);
    if (!parentsOf.has(c)) parentsOf.set(c, []);
    parentsOf.get(c)!.push(link);
  }

  // BFS queue: [nodeId, depth]
  const queue: Array<[string, number]> = [[rootId, 0]];

  while (queue.length > 0) {
    const [currentId, depth] = queue.shift()!;
    if (depth >= MAX_DEPTH) continue;

    // Traverse children (downstream)
    for (const link of (childrenOf.get(currentId) ?? [])) {
      const childId = String(link.child_entity_id);
      const edgeKey = `${String(link._id)}`;
      if (!edgeSeen.has(edgeKey)) {
        edgeSeen.add(edgeKey);
        edges.push({
          id: edgeKey,
          parent_id: currentId,
          child_id: childId,
          tier_offset: link.tier_offset,
          source: link.source,
          confidence_pct: link.confidence_pct ?? 100,
        });
      }
      if (!nodeIds.has(childId)) {
        nodeIds.add(childId);
        queue.push([childId, depth + 1]);
      }
    }

    // Traverse parents (upstream)
    for (const link of (parentsOf.get(currentId) ?? [])) {
      const parentId = String(link.parent_entity_id);
      const edgeKey = `${String(link._id)}`;
      if (!edgeSeen.has(edgeKey)) {
        edgeSeen.add(edgeKey);
        edges.push({
          id: edgeKey,
          parent_id: parentId,
          child_id: currentId,
          tier_offset: link.tier_offset,
          source: link.source,
          confidence_pct: link.confidence_pct ?? 100,
        });
      }
      if (!nodeIds.has(parentId)) {
        nodeIds.add(parentId);
        queue.push([parentId, depth + 1]);
      }
    }
  }

  return { nodeIds, edges };
}

/** Detect if a set of links contains any cycle using DFS. */
export function hasCycle(links: LinkRecord[]): boolean {
  const adjacency = new Map<string, string[]>();
  for (const link of links) {
    const p = String(link.parent_entity_id);
    const c = String(link.child_entity_id);
    if (!adjacency.has(p)) adjacency.set(p, []);
    adjacency.get(p)!.push(c);
  }

  const visited  = new Set<string>();
  const inStack  = new Set<string>();

  function dfs(node: string): boolean {
    visited.add(node);
    inStack.add(node);
    for (const neighbor of (adjacency.get(node) ?? [])) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (inStack.has(neighbor)) {
        return true;
      }
    }
    inStack.delete(node);
    return false;
  }

  for (const node of adjacency.keys()) {
    if (!visited.has(node) && dfs(node)) return true;
  }
  return false;
}

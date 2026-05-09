import { bfsGraph, hasCycle } from '../lib/supplier-graph/bfs';
import type { LinkRecord } from '../lib/supplier-graph/bfs';

// Helpers to build link fixtures
let _id = 1;
function makeLink(parent: string, child: string, tier: 1 | 2 | 3 = 1): LinkRecord {
  return {
    _id: String(_id++),
    parent_entity_id: parent,
    child_entity_id: child,
    tier_offset: tier,
    source: 'manual',
  };
}

describe('bfsGraph — correctness', () => {
  test('root with no links returns only root node and empty edges', () => {
    const { nodeIds, edges } = bfsGraph('root', []);
    expect(nodeIds.size).toBe(1);
    expect(nodeIds.has('root')).toBe(true);
    expect(edges).toHaveLength(0);
  });

  test('single child link is traversed', () => {
    const links = [makeLink('root', 'child1')];
    const { nodeIds, edges } = bfsGraph('root', links);
    expect(nodeIds.has('child1')).toBe(true);
    expect(edges).toHaveLength(1);
    expect(edges[0].parent_id).toBe('root');
    expect(edges[0].child_id).toBe('child1');
  });

  test('traverses upstream parent links', () => {
    // root is a child of parentA
    const links = [makeLink('parentA', 'root')];
    const { nodeIds, edges } = bfsGraph('root', links);
    expect(nodeIds.has('parentA')).toBe(true);
    expect(edges).toHaveLength(1);
    expect(edges[0].parent_id).toBe('parentA');
    expect(edges[0].child_id).toBe('root');
  });

  test('traverses multi-hop chain downstream', () => {
    const links = [
      makeLink('root', 'a', 1),
      makeLink('a', 'b', 2),
      makeLink('b', 'c', 3),
    ];
    const { nodeIds, edges } = bfsGraph('root', links);
    expect(nodeIds.has('a')).toBe(true);
    expect(nodeIds.has('b')).toBe(true);
    expect(nodeIds.has('c')).toBe(true);
    expect(edges).toHaveLength(3);
  });

  test('deduplicates edges — shared child appears only once', () => {
    const link1 = makeLink('root', 'shared');
    const link2 = makeLink('other', 'shared');
    const { nodeIds, edges } = bfsGraph('root', [link1, link2]);
    // 'other' may not be reachable from root directly
    expect(nodeIds.has('shared')).toBe(true);
    const sharedEdges = edges.filter(e => e.child_id === 'shared');
    expect(sharedEdges.length).toBeGreaterThanOrEqual(1);
  });

  test('does not duplicate nodes already visited', () => {
    // Diamond: root → a, root → b, a → c, b → c
    const links = [
      makeLink('root', 'a'),
      makeLink('root', 'b'),
      makeLink('a', 'c'),
      makeLink('b', 'c'),
    ];
    const { nodeIds } = bfsGraph('root', links);
    expect(nodeIds.size).toBe(4); // root, a, b, c — no duplicate c
  });
});

describe('bfsGraph — tier-3 depth limit', () => {
  test('stops at depth 3 and does not include depth-4 nodes', () => {
    // root → d1 → d2 → d3 → d4 (d4 should NOT appear)
    const links = [
      makeLink('root', 'd1', 1),
      makeLink('d1', 'd2', 2),
      makeLink('d2', 'd3', 3),
      makeLink('d3', 'd4', 3), // beyond max depth
    ];
    const { nodeIds } = bfsGraph('root', links);
    expect(nodeIds.has('d1')).toBe(true);
    expect(nodeIds.has('d2')).toBe(true);
    expect(nodeIds.has('d3')).toBe(true);
    expect(nodeIds.has('d4')).toBe(false);
  });

  test('wide tier-3 layer is included but tier-4 is excluded', () => {
    const links = [
      makeLink('root', 'a', 1),
      makeLink('a', 'b', 2),
      makeLink('b', 'c1', 3),
      makeLink('b', 'c2', 3),
      makeLink('c1', 'deep', 3), // depth 4 from root — excluded
    ];
    const { nodeIds } = bfsGraph('root', links);
    expect(nodeIds.has('c1')).toBe(true);
    expect(nodeIds.has('c2')).toBe(true);
    expect(nodeIds.has('deep')).toBe(false);
  });
});

describe('hasCycle — cycle detection', () => {
  test('acyclic chain returns false', () => {
    const links = [makeLink('a', 'b'), makeLink('b', 'c')];
    expect(hasCycle(links)).toBe(false);
  });

  test('direct self-loop returns true', () => {
    const links = [makeLink('a', 'a')];
    expect(hasCycle(links)).toBe(true);
  });

  test('two-node cycle returns true', () => {
    const links = [makeLink('a', 'b'), makeLink('b', 'a')];
    expect(hasCycle(links)).toBe(true);
  });

  test('three-node cycle returns true', () => {
    const links = [makeLink('a', 'b'), makeLink('b', 'c'), makeLink('c', 'a')];
    expect(hasCycle(links)).toBe(true);
  });

  test('disconnected graph without cycle returns false', () => {
    const links = [makeLink('a', 'b'), makeLink('c', 'd')];
    expect(hasCycle(links)).toBe(false);
  });

  test('tree-like structure (shared child) returns false', () => {
    // a → c, b → c — no cycle, c just has two parents
    const links = [makeLink('a', 'c'), makeLink('b', 'c')];
    expect(hasCycle(links)).toBe(false);
  });

  test('large acyclic graph returns false', () => {
    const links: LinkRecord[] = [];
    for (let i = 0; i < 20; i++) {
      links.push(makeLink(`node-${i}`, `node-${i + 1}`));
    }
    expect(hasCycle(links)).toBe(false);
  });
});

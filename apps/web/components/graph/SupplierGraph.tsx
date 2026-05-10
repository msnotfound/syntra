'use client';

import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useRouter } from 'next/navigation';
import { colors } from '@syntra/ui/tokens';

export interface GraphNodeData {
  id: string;
  name: string;
  type: string;
  country_code: string | null;
  supplier_tier: number | null;
  var_value_usd: number | null;
  is_root: boolean;
}

export interface GraphEdgeData {
  id: string;
  parent_id: string;
  child_id: string;
  tier_offset: number;
  source: string;
  confidence_pct: number;
}

interface SupplierGraphProps {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  orgSlug: string;
  onNodeSelect?: (node: GraphNodeData | null) => void;
}

const TYPE_ICONS: Record<string, string> = {
  supplier: '🏭',
  port: '⚓',
  route: '➡',
  country: '🏴',
  region: '🌐',
  asset: '📦',
};

function varToSeverityColor(varUsd: number | null): string {
  if (varUsd === null) return colors.bg.surface2;
  if (varUsd >= 1_000_000) return colors.severity.critical;
  if (varUsd >= 500_000)   return colors.severity.high;
  if (varUsd >= 100_000)   return colors.severity.medium;
  return colors.severity.low;
}

function edgeStyleForConfidence(confidencePct: number): { stroke: string; strokeDasharray?: string } {
  if (confidencePct >= 85) return { stroke: colors.accent.DEFAULT };
  if (confidencePct >= 60) return { stroke: colors.text.muted };
  return { stroke: colors.border.default, strokeDasharray: '6 4' };
}

function EntityNode({ data }: { data: GraphNodeData & { onClick: () => void } }) {
  const borderColor = data.is_root ? colors.accent.DEFAULT : varToSeverityColor(data.var_value_usd);
  const tierLabel = data.supplier_tier ? `T${data.supplier_tier}` : null;

  return (
    <div
      onClick={data.onClick}
      style={{
        background: colors.bg.surface,
        border: `2px solid ${borderColor}`,
        borderRadius: '6px',
        padding: '8px 12px',
        minWidth: 140,
        cursor: 'pointer',
        fontFamily: 'Inter, system-ui, sans-serif',
        transition: '150ms ease-out',
        boxShadow: data.is_root ? `0 0 0 3px ${colors.accent.DEFAULT}33` : 'none',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: borderColor, border: 'none', width: 8, height: 8 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14 }}>{TYPE_ICONS[data.type] ?? '•'}</span>
        {tierLabel && (
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            color: colors.bg.base,
            background: borderColor,
            borderRadius: 3,
            padding: '1px 4px',
            fontFamily: 'monospace',
          }}>
            {tierLabel}
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: colors.text.primary, marginTop: 4, lineHeight: 1.3 }}>
        {data.name}
      </div>
      {data.country_code && (
        <div style={{ fontSize: 11, color: colors.text.muted, marginTop: 2, fontFamily: 'monospace' }}>
          {data.country_code}
        </div>
      )}
      {data.var_value_usd !== null && (
        <div style={{ fontSize: 11, color: colors.text.secondary, marginTop: 3, fontFamily: 'monospace' }}>
          ${(data.var_value_usd / 1000).toFixed(0)}K VaR
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: borderColor, border: 'none', width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes: NodeTypes = { entity: EntityNode as NodeTypes['entity'] };

function layoutNodes(nodeData: GraphNodeData[], edgeData: GraphEdgeData[]): { rfNodes: Node[]; rfEdges: Edge[] } {
  // Simple layered layout: tier-1 top, tier-2 mid, tier-3 bottom, root center
  const LAYER_Y: Record<number, number> = { 0: 0, 1: 160, 2: 320, 3: 480 };
  const tierBuckets: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [] };

  for (const n of nodeData) {
    const t = n.supplier_tier ?? (n.is_root ? 0 : 1);
    (tierBuckets[t] ?? tierBuckets[1]).push(n.id);
  }

  const nodeIdToPos = new Map<string, { x: number; y: number }>();
  for (const [tier, ids] of Object.entries(tierBuckets)) {
    const t = Number(tier);
    const y = LAYER_Y[t] ?? t * 160;
    ids.forEach((id, i) => {
      nodeIdToPos.set(id, { x: (i - (ids.length - 1) / 2) * 200, y });
    });
  }

  const rfNodes: Node[] = nodeData.map(n => ({
    id: n.id,
    type: 'entity',
    position: nodeIdToPos.get(n.id) ?? { x: 0, y: 0 },
    data: n,
  }));

  const rfEdges: Edge[] = edgeData.map(e => {
    const confidenceStyle = edgeStyleForConfidence(e.confidence_pct);
    return {
      id: e.id,
      source: e.parent_id,
      target: e.child_id,
      style: {
        ...confidenceStyle,
        strokeWidth: 2,
      },
      label: `T${e.tier_offset} ${e.confidence_pct}%`,
      labelStyle: { fill: colors.text.muted, fontSize: 10 },
      labelBgStyle: { fill: colors.bg.surface2 },
      animated: false,
    };
  });

  return { rfNodes, rfEdges };
}

export default function SupplierGraph({ nodes, edges, orgSlug, onNodeSelect }: SupplierGraphProps) {
  const router = useRouter();
  const { rfNodes: initialNodes, rfEdges: initialEdges } = useMemo(() => layoutNodes(nodes, edges), [nodes, edges]);

  const nodesWithClick: Node[] = useMemo(() => initialNodes.map(n => ({
    ...n,
    data: {
      ...n.data,
      onClick: () => {
        onNodeSelect?.(n.data as GraphNodeData);
      },
    },
  })), [initialNodes, onNodeSelect]);

  const [rfNodes, , onNodesChange] = useNodesState(nodesWithClick);
  const [rfEdges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    router.push(`/app/${orgSlug}/watchlist`);
  }, [router, orgSlug]);

  if (nodes.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 12,
        color: colors.text.muted,
      }}>
        <span style={{ fontSize: 32 }}>🕸️</span>
        <p style={{ fontSize: 14, color: colors.text.secondary, margin: 0 }}>No supplier links found for this entity.</p>
        <p style={{ fontSize: 12, color: colors.text.muted, margin: 0 }}>Import a CSV or add links manually to build the graph.</p>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDoubleClick={onNodeDoubleClick}
      nodeTypes={nodeTypes}
      fitView
      style={{ background: colors.bg.base }}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color={colors.bg.surface2}
      />
      <Controls
        style={{
          background: colors.bg.surface,
          border: `1px solid ${colors.border.default}`,
          borderRadius: 6,
        }}
      />
      <MiniMap
        nodeColor={(n) => varToSeverityColor((n.data as GraphNodeData).var_value_usd)}
        style={{
          background: colors.bg.surface,
          border: `1px solid ${colors.border.default}`,
          borderRadius: 6,
        }}
      />
    </ReactFlow>
  );
}

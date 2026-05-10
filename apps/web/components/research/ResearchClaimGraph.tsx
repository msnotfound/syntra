'use client';
import { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { colors } from '@syntra/ui/tokens';

const KIND_COLOR: Record<string, string> = {
  fact:      colors.severity.low,
  inference: colors.severity.medium,
  forecast:  colors.severity.high,
};

function ClaimNode({ data }: { data: { label: string; kind: string } }) {
  return (
    <div style={{
      background: colors.bg.surface2,
      border: `1px solid ${KIND_COLOR[data.kind] ?? colors.border.subtle}`,
      borderRadius: 4,
      padding: '6px 10px',
      fontSize: 11,
      color: colors.text.secondary,
      maxWidth: 180,
      lineHeight: 1.4,
    }}>
      <Handle type="target" position={Position.Left} style={{ background: KIND_COLOR[data.kind] ?? colors.accent }} />
      <div style={{ color: KIND_COLOR[data.kind] ?? colors.text.muted, fontSize: 9, fontFamily: 'monospace', marginBottom: 2 }}>
        {data.kind}
      </div>
      {data.label}
      <Handle type="source" position={Position.Right} style={{ background: KIND_COLOR[data.kind] ?? colors.accent }} />
    </div>
  );
}

const NODE_TYPES = { claim: ClaimNode };

interface Props {
  nodes: Array<{ id: string; label: string; kind: string }>;
  edges: Array<{ from: string; to: string; label: string }>;
}

export function ResearchClaimGraph({ nodes, edges }: Props) {
  const rfNodes: Node[] = useMemo(() =>
    nodes.map((n, i) => ({
      id: n.id,
      type: 'claim',
      position: {
        x: (i % 4) * 220 + 20,
        y: Math.floor(i / 4) * 100 + 20,
      },
      data: { label: n.label.slice(0, 60), kind: n.kind },
    })), [nodes]);

  const rfEdges: Edge[] = useMemo(() =>
    edges.map((e, i) => ({
      id: `e-${i}`,
      source: e.from,
      target: e.to,
      label: e.label,
      style: { stroke: colors.border.default, strokeWidth: 1 },
      labelStyle: { fontSize: 9, fill: colors.text.muted },
    })), [edges]);

  const [rfN, , onNodesChange] = useNodesState(rfNodes);
  const [rfE, , onEdgesChange] = useEdgesState(rfEdges);

  return (
    <ReactFlow
      nodes={rfN}
      edges={rfE}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={NODE_TYPES}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={colors.border.subtle} />
      <Controls style={{ background: colors.bg.surface2, border: `1px solid ${colors.border.subtle}` }} />
    </ReactFlow>
  );
}

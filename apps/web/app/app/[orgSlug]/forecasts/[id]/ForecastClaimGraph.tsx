'use client';

import { useMemo, type CSSProperties } from 'react';
import ReactFlow, {
  Background,
  Controls,
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
import { colors, typography, radii } from '@syntra/ui/tokens';
import type { AdmiraltyCode } from '@/components/intel/SourceBadge';

const ADMIRALTY_TEXT: Record<AdmiraltyCode, string> = {
  A: '#4ade80',
  B: '#60a5fa',
  C: '#eab308',
  D: '#f97316',
  E: '#ef4444',
  F: '#64748b',
};

const CLAIM_TYPE_COLOR: Record<string, string> = {
  fact:      colors.severity.low,
  inference: colors.severity.medium,
  forecast:  colors.severity.high,
};

export interface ClaimNodeData {
  claim_id: string;
  claim_text: string;
  claim_type: 'fact' | 'inference' | 'forecast';
  asserted_at: string;
  source_name: string | null;
  admiralty_code: AdmiraltyCode | null;
  reliability_pct: number | null;
  evidence_url: string | null;
  is_root: boolean;
}

export interface ForecastGraphProps {
  forecastId: string;
  forecastLabel: string;
  probability_pct: number;
  claims: ClaimNodeData[];
  edges: Array<{ id: string; source: string; target: string }>;
}

function ForecastRootNode({ data }: { data: { label: string; probability_pct: number } }) {
  const tone = data.probability_pct >= 66 ? colors.severity.high :
    data.probability_pct >= 40 ? colors.severity.medium :
    colors.severity.low;

  return (
    <div
      style={{
        background: colors.bg.surface,
        border: `2px solid ${tone}`,
        borderRadius: radii.md,
        padding: '10px 14px',
        minWidth: 180,
        textAlign: 'center',
        boxShadow: `0 0 0 3px ${tone}33`,
      }}
    >
      <div
        style={{
          fontSize: typography.sizes.xs,
          color: tone,
          fontFamily: typography.fonts.mono,
          fontWeight: typography.weights.semibold,
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        FORECAST · {data.probability_pct}%
      </div>
      <div
        style={{
          fontSize: typography.sizes.sm,
          color: colors.text.primary,
          fontWeight: typography.weights.medium,
          lineHeight: 1.3,
        }}
      >
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: tone, border: 'none', width: 8, height: 8 }} />
    </div>
  );
}

function ClaimNodeComponent({ data }: { data: ClaimNodeData }) {
  const typeColor = CLAIM_TYPE_COLOR[data.claim_type] ?? colors.text.muted;
  const admiraltyText = data.admiralty_code ? (ADMIRALTY_TEXT[data.admiralty_code] ?? colors.text.muted) : colors.text.muted;
  const borderColor = data.is_root ? colors.accent.DEFAULT : typeColor;

  return (
    <div
      style={{
        background: colors.bg.surface,
        border: `1px solid ${borderColor}`,
        borderRadius: radii.md,
        padding: '8px 10px',
        maxWidth: 220,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: borderColor, border: 'none', width: 6, height: 6 }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: typeColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 10,
            color: colors.text.muted,
            fontFamily: typography.fonts.mono,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {data.claim_type}
        </span>
        {data.admiralty_code && (
          <span
            style={{
              fontSize: 10,
              fontFamily: typography.fonts.mono,
              fontWeight: typography.weights.semibold,
              color: admiraltyText,
              marginLeft: 2,
            }}
          >
            [{data.admiralty_code}]
          </span>
        )}
      </div>

      {/* Claim text */}
      <p
        style={{
          fontSize: 11,
          color: colors.text.primary,
          lineHeight: 1.4,
          margin: 0,
          marginBottom: data.source_name ? 4 : 0,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        } as CSSProperties}
      >
        {data.claim_text}
      </p>

      {/* Source name */}
      {data.source_name && (
        <div
          style={{
            fontSize: 10,
            color: colors.text.muted,
            fontFamily: typography.fonts.mono,
            marginTop: 2,
          }}
        >
          {data.source_name}
          {data.reliability_pct !== null && ` · ${data.reliability_pct}%`}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: typeColor, border: 'none', width: 6, height: 6 }} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  forecast:  ForecastRootNode as NodeTypes['forecast'],
  claim:     ClaimNodeComponent as NodeTypes['claim'],
};

function layoutGraph(
  forecastId: string,
  forecastLabel: string,
  probability_pct: number,
  claims: ClaimNodeData[],
  rawEdges: ForecastGraphProps['edges'],
): { rfNodes: Node[]; rfEdges: Edge[] } {
  // Build depth map via BFS from root (forecastId)
  const childMap = new Map<string, string[]>();
  for (const e of rawEdges) {
    if (!childMap.has(e.source)) childMap.set(e.source, []);
    childMap.get(e.source)!.push(e.target);
  }

  const depthMap = new Map<string, number>();
  depthMap.set(forecastId, 0);
  const queue = [forecastId];
  while (queue.length) {
    const cur = queue.shift()!;
    const depth = depthMap.get(cur) ?? 0;
    for (const child of childMap.get(cur) ?? []) {
      if (!depthMap.has(child)) {
        depthMap.set(child, depth + 1);
        queue.push(child);
      }
    }
  }

  // Group by depth
  const byDepth = new Map<number, string[]>();
  depthMap.forEach((d, id) => {
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(id);
  });

  const positions = new Map<string, { x: number; y: number }>();
  byDepth.forEach((ids, depth) => {
    ids.forEach((id, i) => {
      positions.set(id, {
        x: (i - (ids.length - 1) / 2) * 260,
        y: depth * 160,
      });
    });
  });

  const rfNodes: Node[] = [
    {
      id: forecastId,
      type: 'forecast',
      position: positions.get(forecastId) ?? { x: 0, y: 0 },
      data: { label: forecastLabel, probability_pct },
    },
    ...claims.map(c => ({
      id: c.claim_id,
      type: 'claim',
      position: positions.get(c.claim_id) ?? { x: 0, y: 160 },
      data: c,
    })),
  ];

  const rfEdges: Edge[] = rawEdges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    style: { stroke: colors.border.default, strokeWidth: 1.5 },
    animated: false,
  }));

  return { rfNodes, rfEdges };
}

export function ForecastClaimGraph({
  forecastId,
  forecastLabel,
  probability_pct,
  claims,
  edges: rawEdges,
}: ForecastGraphProps) {
  const { rfNodes: initialNodes, rfEdges: initialEdges } = useMemo(
    () => layoutGraph(forecastId, forecastLabel, probability_pct, claims, rawEdges),
    [forecastId, forecastLabel, probability_pct, claims, rawEdges],
  );

  const [rfNodes, , onNodesChange] = useNodesState(initialNodes);
  const [rfEdges, , onEdgesChange] = useEdgesState(initialEdges);

  if (claims.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 28, color: colors.text.disabled }}>⬡</span>
        <p style={{ fontSize: typography.sizes.sm, color: colors.text.muted, margin: 0 }}>
          No supporting claims recorded for this forecast.
        </p>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      style={{ background: colors.bg.base }}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color={colors.bg.surface2}
      />
      <Controls
        style={{
          background: colors.bg.surface,
          border: `1px solid ${colors.border.default}`,
          borderRadius: radii.md,
        }}
      />
    </ReactFlow>
  );
}

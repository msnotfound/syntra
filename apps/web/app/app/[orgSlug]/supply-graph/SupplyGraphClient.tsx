'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { GraphNodeData, GraphEdgeData } from '@/components/graph/SupplierGraph';
import { colors } from '@syntra/ui/tokens';

const SupplierGraph = dynamic(() => import('@/components/graph/SupplierGraph'), { ssr: false });

const TYPE_ICONS: Record<string, string> = {
  supplier: '🏭', port: '⚓', route: '➡', country: '🏴', region: '🌐', asset: '📦',
};

interface Props {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  orgSlug: string;
  rootEntityId: string;
  entityOptions: Array<{ id: string; name: string; type: string }>;
}

function formatUsd(v: number | null): string {
  if (v === null) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export default function SupplyGraphClient({ nodes, edges, orgSlug, rootEntityId, entityOptions }: Props) {
  const [selected, setSelected] = useState<GraphNodeData | null>(null);
  const [activeEntityId, setActiveEntityId] = useState(rootEntityId);

  const tierCounts = [1, 2, 3].map(t => ({
    tier: t,
    count: nodes.filter(n => n.supplier_tier === t).length,
  }));

  const handleEntityChange = (id: string) => {
    setActiveEntityId(id);
    window.location.href = `/app/${orgSlug}/supply-graph?entityId=${id}`;
  };

  return (
    <div className="flex gap-0 h-full" style={{ minHeight: 600 }}>
      {/* Graph canvas */}
      <div className="flex-1 relative" style={{
        border: `1px solid ${colors.border.subtle}`,
        borderRadius: '6px',
        overflow: 'hidden',
        background: colors.bg.base,
        minHeight: 600,
      }}>
        {/* Canvas toolbar */}
        <div style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: selected ? 332 : 12,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <select
            value={activeEntityId}
            onChange={e => handleEntityChange(e.target.value)}
            style={{
              background: colors.bg.surface,
              border: `1px solid ${colors.border.default}`,
              borderRadius: '6px',
              color: colors.text.primary,
              fontSize: 13,
              padding: '4px 8px',
              cursor: 'pointer',
              maxWidth: 220,
            }}
          >
            {entityOptions.map(e => (
              <option key={e.id} value={e.id}>{TYPE_ICONS[e.type] ?? '•'} {e.name}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            {tierCounts.map(({ tier, count }) => (
              <span key={tier} style={{
                fontSize: 11,
                color: colors.text.muted,
                background: colors.bg.surface,
                border: `1px solid ${colors.border.subtle}`,
                borderRadius: 4,
                padding: '2px 6px',
                fontFamily: 'monospace',
              }}>
                T{tier}: {count}
              </span>
            ))}
          </div>
        </div>

        <SupplierGraph
          nodes={nodes}
          edges={edges}
          orgSlug={orgSlug}
          onNodeSelect={setSelected}
        />
      </div>

      {/* Sidebar */}
      {selected && (
        <div style={{
          width: 320,
          marginLeft: 16,
          background: colors.bg.surface,
          border: `1px solid ${colors.border.subtle}`,
          borderRadius: '6px',
          padding: 20,
          flexShrink: 0,
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.text.secondary }}>
              Entity Detail
            </span>
            <button
              onClick={() => setSelected(null)}
              style={{ color: colors.text.muted, fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>{TYPE_ICONS[selected.type] ?? '•'}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: colors.text.primary }}>{selected.name}</div>
              <div style={{ fontSize: 12, color: colors.text.muted, textTransform: 'capitalize' }}>{selected.type}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selected.supplier_tier && (
              <Row label="Tier" value={`Tier ${selected.supplier_tier}`} />
            )}
            {selected.country_code && (
              <Row label="Country" value={selected.country_code} mono />
            )}
            <Row label="VaR (USD)" value={formatUsd(selected.var_value_usd)} mono />

            <div style={{ borderTop: `1px solid ${colors.border.subtle}`, paddingTop: 10, marginTop: 4 }}>
              <div style={{ fontSize: 11, color: colors.text.muted, marginBottom: 6 }}>
                Upstream parents ({edges.filter(e => e.child_id === selected.id).length})
              </div>
              {edges
                .filter(e => e.child_id === selected.id)
                .map(e => {
                  const parent = nodes.find(n => n.id === e.parent_id);
                  return parent ? (
                    <div key={e.id} style={{ fontSize: 12, color: colors.text.secondary, padding: '3px 0' }}>
                      {TYPE_ICONS[parent.type]} {parent.name}
                    </div>
                  ) : null;
                })}
              {edges.filter(e => e.child_id === selected.id).length === 0 && (
                <div style={{ fontSize: 12, color: colors.text.disabled }}>None (root or isolated)</div>
              )}
            </div>

            <div style={{ borderTop: `1px solid ${colors.border.subtle}`, paddingTop: 10 }}>
              <div style={{ fontSize: 11, color: colors.text.muted, marginBottom: 6 }}>
                Downstream dependents ({edges.filter(e => e.parent_id === selected.id).length})
              </div>
              {edges
                .filter(e => e.parent_id === selected.id)
                .map(e => {
                  const child = nodes.find(n => n.id === e.child_id);
                  return child ? (
                    <div key={e.id} style={{ fontSize: 12, color: colors.text.secondary, padding: '3px 0' }}>
                      {TYPE_ICONS[child.type]} {child.name}
                    </div>
                  ) : null;
                })}
              {edges.filter(e => e.parent_id === selected.id).length === 0 && (
                <div style={{ fontSize: 12, color: colors.text.disabled }}>None</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: colors.text.muted }}>{label}</span>
      <span style={{ fontSize: 12, color: colors.text.primary, fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
    </div>
  );
}

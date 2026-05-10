'use client';

import { useState } from 'react';
import { colors, typography, radii, transitions } from '@syntra/ui/tokens';

export type AdmiraltyCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface SourceBadgeProps {
  admiralty_code: AdmiraltyCode;
  reliability_pct: number;
  source_name: string;
  size?: 'sm' | 'md';
}

const ADMIRALTY: Record<AdmiraltyCode, { bg: string; text: string; label: string }> = {
  A: { bg: '#14532d', text: '#4ade80', label: 'A — Completely reliable' },
  B: { bg: '#1e3a5f', text: '#60a5fa', label: 'B — Usually reliable' },
  C: { bg: '#3b2f05', text: '#eab308', label: 'C — Fairly reliable' },
  D: { bg: '#431407', text: '#f97316', label: 'D — Not usually reliable' },
  E: { bg: '#450a0a', text: '#ef4444', label: 'E — Unreliable' },
  F: { bg: '#1e2530', text: '#64748b', label: 'F — Cannot be judged' },
};

function ReliabilityBar({ pct }: { pct: number }) {
  const fill =
    pct >= 80 ? colors.severity.low :
    pct >= 50 ? colors.severity.medium :
    colors.severity.critical;

  return (
    <div
      style={{
        height: 3,
        borderRadius: radii.sm,
        backgroundColor: colors.bg.surface3,
        width: 72,
        overflow: 'hidden',
      }}
    >
      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: fill }} />
    </div>
  );
}

export function SourceBadge({ admiralty_code, reliability_pct, source_name, size = 'sm' }: SourceBadgeProps) {
  const [open, setOpen] = useState(false);
  const style = ADMIRALTY[admiralty_code] ?? ADMIRALTY.F;
  const fontSize = size === 'md' ? typography.sizes.sm : typography.sizes.xs;

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: size === 'md' ? '2px 8px' : '1px 6px',
          borderRadius: radii.sm,
          backgroundColor: style.bg,
          color: style.text,
          fontFamily: typography.fonts.mono,
          fontSize,
          fontWeight: typography.weights.medium,
          cursor: 'default',
          transition: transitions.default,
          userSelect: 'none',
        }}
      >
        {admiralty_code}
      </span>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            backgroundColor: colors.bg.surface,
            border: `1px solid ${colors.border.default}`,
            borderRadius: radii.md,
            padding: '10px 12px',
            minWidth: 200,
            boxShadow: `0 4px 16px rgba(0,0,0,0.4)`,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.semibold,
              color: style.text,
              marginBottom: 4,
              fontFamily: typography.fonts.mono,
            }}
          >
            {style.label}
          </div>
          <div
            style={{
              fontSize: typography.sizes.sm,
              color: colors.text.primary,
              marginBottom: 8,
            }}
          >
            {source_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ReliabilityBar pct={reliability_pct} />
            <span
              style={{
                fontSize: typography.sizes.xs,
                color: colors.text.muted,
                fontFamily: typography.fonts.mono,
              }}
            >
              {reliability_pct}% reliability
            </span>
          </div>
        </div>
      )}
    </span>
  );
}

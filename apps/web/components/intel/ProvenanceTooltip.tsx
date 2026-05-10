'use client';

import { useState, useRef, type ReactNode } from 'react';
import { colors, typography, radii, transitions } from '@syntra/ui/tokens';
import type { ProvenanceClaim } from './ProvenanceTrail';
import { SourceBadge } from './SourceBadge';
import type { AdmiraltyCode } from './SourceBadge';

export interface ProvenanceTooltipProps {
  claims: ProvenanceClaim[];
  children: ReactNode;
}

const CLAIM_TYPE_COLORS: Record<string, string> = {
  fact:      colors.severity.low,
  inference: colors.severity.medium,
  forecast:  colors.severity.high,
};

export function ProvenanceTooltip({ claims, children }: ProvenanceTooltipProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topClaim = claims[0] ?? null;

  function handleMouseEnter() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(true);
  }

  function handleMouseLeave() {
    timerRef.current = setTimeout(() => setOpen(false), 120);
  }

  if (!topClaim) return <>{children}</>;

  const asserted = new Date(topClaim.asserted_at);
  const dateStr = asserted.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <span
      style={{ position: 'relative', display: 'inline' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span
        style={{
          borderBottom: `1px dashed ${colors.border.default}`,
          cursor: 'help',
          transition: transitions.default,
        }}
      >
        {children}
      </span>

      {open && (
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: 0,
            zIndex: 60,
            backgroundColor: colors.bg.surface,
            border: `1px solid ${colors.border.default}`,
            borderRadius: radii.md,
            padding: '12px 14px',
            minWidth: 280,
            maxWidth: 360,
            boxShadow: `0 8px 32px rgba(0,0,0,0.5)`,
          }}
        >
          {/* Header */}
          <div
            style={{
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.medium,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: colors.text.secondary,
              marginBottom: 8,
            }}
          >
            Provenance · {claims.length} claim{claims.length !== 1 ? 's' : ''}
          </div>

          {/* Top claim */}
          <div
            style={{
              backgroundColor: colors.bg.surface2,
              borderRadius: radii.md,
              padding: '8px 10px',
              marginBottom: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: CLAIM_TYPE_COLORS[topClaim.claim_type] ?? colors.text.muted,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: typography.sizes.xs,
                  color: colors.text.muted,
                  fontFamily: typography.fonts.mono,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {topClaim.claim_type}
              </span>
              <span style={{ color: colors.border.subtle, fontSize: typography.sizes.xs }}>·</span>
              <span
                style={{
                  fontSize: typography.sizes.xs,
                  color: colors.text.muted,
                  fontFamily: typography.fonts.mono,
                }}
              >
                {dateStr}
              </span>
              {topClaim.source && (
                <>
                  <span style={{ color: colors.border.subtle, fontSize: typography.sizes.xs }}>·</span>
                  <SourceBadge
                    admiralty_code={topClaim.source.admiralty_code as AdmiraltyCode}
                    reliability_pct={topClaim.source.reliability_pct}
                    source_name={topClaim.source.source_name}
                  />
                  <span
                    style={{
                      fontSize: typography.sizes.xs,
                      color: colors.text.secondary,
                    }}
                  >
                    {topClaim.source.source_name}
                  </span>
                </>
              )}
            </div>
            <p
              style={{
                fontSize: typography.sizes.sm,
                color: colors.text.primary,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {topClaim.claim_text}
            </p>
            {topClaim.evidence_url && (
              <a
                href={topClaim.evidence_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: 5,
                  fontSize: typography.sizes.xs,
                  color: colors.accent.DEFAULT,
                  textDecoration: 'none',
                  fontFamily: typography.fonts.mono,
                }}
              >
                Source ↗
              </a>
            )}
          </div>

          {/* Chain depth hint */}
          {claims.length > 1 && (
            <div
              style={{
                fontSize: typography.sizes.xs,
                color: colors.text.muted,
              }}
            >
              + {claims.length - 1} more claim{claims.length - 1 !== 1 ? 's' : ''} in chain
            </div>
          )}
        </div>
      )}
    </span>
  );
}

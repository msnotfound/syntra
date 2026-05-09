'use client';

import { colors, typography, radii, transitions } from '@syntra/ui/tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProvenanceSource {
  source_id: string;
  source_name: string;
  admiralty_code: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  reliability_pct: number;
}

export interface ProvenanceClaim {
  claim_id: string;
  claim_text: string;
  claim_type: 'fact' | 'inference' | 'forecast';
  evidence_url: string | null;
  asserted_at: string | Date;
  source: ProvenanceSource | null;
  parent_claim_ids: string[];
  depth: number;
}

interface ProvenanceTrailProps {
  claims: ProvenanceClaim[];
}

// ---------------------------------------------------------------------------
// Admiralty badge colours — derived from severity tokens where they map;
// remaining tiers use non-severity accent colours from the token palette.
// ---------------------------------------------------------------------------

const ADMIRALTY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  A: { bg: '#14532d', text: '#4ade80', label: 'A — Completely reliable' },
  B: { bg: '#1e3a5f', text: '#60a5fa', label: 'B — Usually reliable' },
  C: { bg: '#3b2f05', text: '#eab308', label: 'C — Fairly reliable' },
  D: { bg: '#431407', text: '#f97316', label: 'D — Not usually reliable' },
  E: { bg: '#450a0a', text: '#ef4444', label: 'E — Unreliable' },
  F: { bg: '#1e2530', text: '#64748b', label: 'F — Cannot be judged' },
};

const CLAIM_TYPE_STYLE: Record<string, { dot: string; label: string }> = {
  fact:      { dot: colors.severity.low,      label: 'Fact' },
  inference: { dot: colors.severity.medium,   label: 'Inference' },
  forecast:  { dot: colors.severity.high,     label: 'Forecast' },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AdmiraltyBadge({ code }: { code: string }) {
  const style = ADMIRALTY_STYLE[code] ?? ADMIRALTY_STYLE.F;
  return (
    <span
      title={style.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 6px',
        borderRadius: radii.sm,
        backgroundColor: style.bg,
        color: style.text,
        fontFamily: typography.fonts.mono,
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.medium,
        transition: transitions.default,
      }}
    >
      {code}
    </span>
  );
}

function ClaimTypeDot({ type }: { type: string }) {
  const style = CLAIM_TYPE_STYLE[type] ?? CLAIM_TYPE_STYLE.fact;
  return (
    <span
      title={style.label}
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: style.dot,
        flexShrink: 0,
        marginTop: 4,
      }}
    />
  );
}

function ReliabilityBar({ pct }: { pct: number }) {
  const fill = pct >= 80
    ? colors.severity.low
    : pct >= 50
    ? colors.severity.medium
    : colors.severity.critical;

  return (
    <div
      style={{
        height: 3,
        borderRadius: radii.sm,
        backgroundColor: colors.bg.surface3,
        width: 60,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          backgroundColor: fill,
          transition: transitions.default,
        }}
      />
    </div>
  );
}

function ClaimNode({ claim, isFirst }: { claim: ProvenanceClaim; isFirst: boolean }) {
  const claimStyle = CLAIM_TYPE_STYLE[claim.claim_type] ?? CLAIM_TYPE_STYLE.fact;
  const asserted = new Date(claim.asserted_at);
  const dateStr = asserted.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {/* Connector column */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
        <ClaimTypeDot type={claim.claim_type} />
        {!isFirst && (
          <div
            style={{
              flex: 1,
              width: 1,
              backgroundColor: colors.border.subtle,
              marginTop: 4,
            }}
          />
        )}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          backgroundColor: colors.bg.surface,
          border: `1px solid ${colors.border.subtle}`,
          borderRadius: radii.md,
          padding: '10px 12px',
          marginBottom: 8,
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.medium,
              color: colors.text.muted,
              fontFamily: typography.fonts.mono,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {claimStyle.label}
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
          {claim.source && (
            <>
              <span style={{ color: colors.border.subtle, fontSize: typography.sizes.xs }}>·</span>
              <AdmiraltyBadge code={claim.source.admiralty_code} />
              <span
                style={{
                  fontSize: typography.sizes.xs,
                  color: colors.text.secondary,
                  fontWeight: typography.weights.medium,
                }}
              >
                {claim.source.source_name}
              </span>
              <ReliabilityBar pct={claim.source.reliability_pct} />
              <span
                style={{
                  fontSize: typography.sizes.xs,
                  color: colors.text.muted,
                  fontFamily: typography.fonts.mono,
                }}
              >
                {claim.source.reliability_pct}%
              </span>
            </>
          )}
        </div>

        {/* Claim text */}
        <p
          style={{
            fontSize: typography.sizes.sm,
            color: colors.text.primary,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {claim.claim_text}
        </p>

        {/* Evidence link */}
        {claim.evidence_url && (
          <a
            href={claim.evidence_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              marginTop: 6,
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProvenanceTrail({ claims }: ProvenanceTrailProps) {
  if (!claims || claims.length === 0) {
    return (
      <p
        style={{
          fontSize: typography.sizes.sm,
          color: colors.text.muted,
          padding: '12px 0',
        }}
      >
        No provenance data available for this alert.
      </p>
    );
  }

  const sorted = [...claims].sort((a, b) => a.depth - b.depth);

  return (
    <div>
      <div
        style={{
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.medium,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: colors.text.secondary,
          marginBottom: 12,
        }}
      >
        Provenance Trail — {claims.length} claim{claims.length !== 1 ? 's' : ''}
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        {Object.entries(CLAIM_TYPE_STYLE).map(([type, s]) => (
          <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: s.dot,
              }}
            />
            <span style={{ fontSize: typography.sizes.xs, color: colors.text.muted }}>
              {s.label}
            </span>
          </span>
        ))}
      </div>

      {/* Chain */}
      <div>
        {sorted.map((claim, i) => (
          <ClaimNode key={claim.claim_id} claim={claim} isFirst={i === sorted.length - 1} />
        ))}
      </div>
    </div>
  );
}

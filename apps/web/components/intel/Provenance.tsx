'use client';

import { useState, type ReactNode } from 'react';
import { colors, typography, radii, transitions } from '@syntra/ui/tokens';
import type { ProvenanceClaim } from './ProvenanceTrail';
import { ProvenanceTrail } from './ProvenanceTrail';

export interface ProvenanceProps {
  claims: ProvenanceClaim[];
  context?: string;
  children: ReactNode;
}

export function Provenance({ claims, context, children }: ProvenanceProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <span style={{ display: 'inline' }}>
        {children}
        {claims.length > 0 && (
          <button
            onClick={() => setModalOpen(true)}
            title={context ? `Why does Syntra say this about "${context}"?` : 'View source chain'}
            aria-label="View provenance"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              marginLeft: 6,
              padding: '1px 5px',
              borderRadius: radii.sm,
              border: `1px solid ${colors.border.default}`,
              backgroundColor: 'transparent',
              color: colors.text.muted,
              fontSize: typography.sizes.xs,
              fontFamily: typography.fonts.mono,
              cursor: 'pointer',
              transition: transitions.default,
              verticalAlign: 'middle',
              lineHeight: 1,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = colors.accent.DEFAULT;
              (e.currentTarget as HTMLButtonElement).style.borderColor = colors.accent.DEFAULT;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = colors.text.muted;
              (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border.default;
            }}
          >
            Why?
          </button>
        )}
      </span>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Provenance chain"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            padding: 16,
            pointerEvents: 'none',
          }}
        >
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              pointerEvents: 'all',
            }}
            onClick={() => setModalOpen(false)}
          />

          {/* Panel */}
          <div
            style={{
              position: 'relative',
              zIndex: 101,
              backgroundColor: colors.bg.surface,
              border: `1px solid ${colors.border.default}`,
              borderRadius: radii.md,
              padding: 20,
              width: 440,
              maxWidth: '100vw',
              maxHeight: '80vh',
              overflowY: 'auto',
              pointerEvents: 'all',
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: typography.sizes.sm,
                    fontWeight: typography.weights.semibold,
                    color: colors.text.primary,
                  }}
                >
                  Why do we say that?
                </div>
                {context && (
                  <div
                    style={{
                      fontSize: typography.sizes.xs,
                      color: colors.text.muted,
                      marginTop: 2,
                    }}
                  >
                    {context}
                  </div>
                )}
              </div>
              <button
                onClick={() => setModalOpen(false)}
                aria-label="Close provenance panel"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: radii.sm,
                  border: `1px solid ${colors.border.default}`,
                  backgroundColor: 'transparent',
                  color: colors.text.muted,
                  cursor: 'pointer',
                  fontSize: typography.sizes.sm,
                  transition: transitions.default,
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            <ProvenanceTrail claims={claims} />
          </div>
        </div>
      )}
    </>
  );
}

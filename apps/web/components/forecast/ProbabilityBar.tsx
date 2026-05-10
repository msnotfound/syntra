'use client';

// Horizontal probability bar.
// Width = probability_pct%. Color:
//   ≥66% → orange (#F97316) — high-confidence FORECAST
//   ≥40% → amber (#EAB308)  — elevated
//   <40%  → blue (#60A5FA)   — low probability
// Orange is the FORECAST accent per design guide §23 Screen 41.
// Never use red — that color is reserved for real-time alerts.

interface ProbabilityBarProps {
  probability_pct: number;
  className?: string;
}

function getColor(pct: number): string {
  if (pct >= 66) return '#F97316';
  if (pct >= 40) return '#EAB308';
  return '#60A5FA';
}

export function ProbabilityBar({ probability_pct, className = '' }: ProbabilityBarProps) {
  const clamped = Math.max(0, Math.min(100, probability_pct));
  const color   = getColor(clamped);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div style={{ backgroundColor: '#1E2530', borderRadius: '4px', height: '6px', flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            width:           `${clamped}%`,
            height:          '100%',
            backgroundColor: color,
            borderRadius:    '4px',
            transition:      '150ms ease-out',
          }}
        />
      </div>
      <span
        style={{
          color,
          fontFamily: '"Geist Mono", monospace',
          fontSize:   '12px',
          minWidth:   '36px',
          textAlign:  'right',
        }}
      >
        {clamped}%
      </span>
    </div>
  );
}

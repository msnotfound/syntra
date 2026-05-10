'use client';

// Horizontal probability bar.
// Width = probability_pct%. Tone follows forecast severity tiers.
// Never use red — that color is reserved for real-time alerts.

interface ProbabilityBarProps {
  probability_pct: number;
  className?: string;
}

function getToneClass(pct: number): string {
  if (pct >= 66) return 'bg-severity-high text-severity-high';
  if (pct >= 40) return 'bg-severity-medium text-severity-medium';
  return 'bg-severity-low text-severity-low';
}

export function ProbabilityBar({ probability_pct, className = '' }: ProbabilityBarProps) {
  const clamped = Math.max(0, Math.min(100, probability_pct));
  const toneClass = getToneClass(clamped);
  const [barClass, textClass] = toneClass.split(' ');

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="bg-bg-surface-2 rounded-sm h-1.5 flex-1 overflow-hidden">
        <div
          className={`h-full rounded-sm transition-colors duration-[150ms] ease-out ${barClass}`}
          style={{
            // dynamic — token cast required
            width:           `${clamped}%`,
          }}
        />
      </div>
      <span
        className={`font-mono text-xs min-w-9 text-right ${textClass}`}
      >
        {clamped}%
      </span>
    </div>
  );
}

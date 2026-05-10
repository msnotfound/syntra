import React from 'react';
import { clsx } from 'clsx';

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

const SEVERITY_STYLES: Record<Severity, { bg: string; text: string; dot: string }> = {
  critical: { bg: 'bg-severity-critical/15', text: 'text-severity-critical', dot: 'bg-severity-critical' },
  high:     { bg: 'bg-severity-high/15', text: 'text-severity-high', dot: 'bg-severity-high' },
  medium:   { bg: 'bg-severity-medium/15', text: 'text-severity-medium', dot: 'bg-severity-medium' },
  low:      { bg: 'bg-severity-low/15', text: 'text-severity-low', dot: 'bg-severity-low' },
  info:     { bg: 'bg-text-secondary/15', text: 'text-text-secondary', dot: 'bg-text-secondary' },
};

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const styles = SEVERITY_STYLES[severity];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 h-5',
        'text-[11px] font-medium uppercase tracking-wider',
        'rounded-sm',
        styles.bg,
        styles.text,
        className
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-sm flex-shrink-0', styles.dot)} />
      {severity}
    </span>
  );
}

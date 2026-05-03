import React from 'react';
import { clsx } from 'clsx';

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

const SEVERITY_STYLES: Record<Severity, { bg: string; text: string; dot: string }> = {
  critical: { bg: 'bg-[#EF4444]/15', text: 'text-[#EF4444]', dot: 'bg-[#EF4444]' },
  high:     { bg: 'bg-[#F97316]/15', text: 'text-[#F97316]', dot: 'bg-[#F97316]' },
  medium:   { bg: 'bg-[#EAB308]/15', text: 'text-[#EAB308]', dot: 'bg-[#EAB308]' },
  low:      { bg: 'bg-[#60A5FA]/15', text: 'text-[#60A5FA]', dot: 'bg-[#60A5FA]' },
  info:     { bg: 'bg-[#94A3B8]/15', text: 'text-[#94A3B8]', dot: 'bg-[#94A3B8]' },
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
        'rounded-[4px]',
        styles.bg,
        styles.text,
        className
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', styles.dot)} />
      {severity}
    </span>
  );
}

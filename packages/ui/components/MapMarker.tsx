import React from 'react';
import { clsx } from 'clsx';

type MarkerType = 'event' | 'watchlist' | 'affected';
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

const EVENT_BG_CLASS: Record<Severity, string> = {
  critical: 'bg-severity-critical',
  high:     'bg-severity-high',
  medium:   'bg-severity-medium',
  low:      'bg-severity-low',
  info:     'bg-text-secondary',
};

interface MapMarkerProps {
  type: MarkerType;
  severity?: Severity;
  pulse?: boolean;
  className?: string;
}

export function MapMarker({ type, severity = 'info', pulse = false, className }: MapMarkerProps) {
  if (type === 'watchlist') {
    return (
      <div
        className={clsx('w-3 h-3 rounded-sm border-2 border-text-primary bg-accent', className)}
      />
    );
  }

  const colorClass = EVENT_BG_CLASS[severity];

  if (type === 'event') {
    return (
      <div className={clsx('relative flex items-center justify-center', className)}>
        {pulse && (
          <span
            className={clsx('absolute inline-flex w-6 h-6 rounded-sm opacity-75 animate-ping', colorClass)}
          />
        )}
        <span
          className={clsx('relative inline-flex w-3 h-3 rounded-sm', colorClass)}
        />
      </div>
    );
  }

  // affected
  return (
    <div
      className={clsx('w-3 h-3 rounded-sm border border-text-primary bg-severity-high', className)}
    />
  );
}

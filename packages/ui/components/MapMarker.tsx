import React from 'react';
import { clsx } from 'clsx';

type MarkerType = 'event' | 'watchlist' | 'affected';
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

const EVENT_COLORS: Record<Severity, string> = {
  critical: '#EF4444',
  high:     '#F97316',
  medium:   '#EAB308',
  low:      '#60A5FA',
  info:     '#94A3B8',
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
        className={clsx('w-3 h-3 rounded-full border-2 border-white bg-[#3B82F6]', className)}
      />
    );
  }

  const color = EVENT_COLORS[severity];

  if (type === 'event') {
    return (
      <div className={clsx('relative flex items-center justify-center', className)}>
        {pulse && (
          <span
            className="absolute inline-flex rounded-full opacity-75 animate-ping"
            style={{ width: 24, height: 24, backgroundColor: color }}
          />
        )}
        <span
          className="relative inline-flex rounded-full"
          style={{ width: 12, height: 12, backgroundColor: color }}
        />
      </div>
    );
  }

  // affected
  return (
    <div
      className={clsx('w-3 h-3 rounded-sm border border-white', className)}
      style={{ backgroundColor: EVENT_COLORS.high }}
    />
  );
}

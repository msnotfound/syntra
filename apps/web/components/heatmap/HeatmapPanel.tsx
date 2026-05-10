'use client';

import Link from 'next/link';
import type { Severity } from '@syntra/shared';

export interface HeatmapCell {
  region: string;
  score: number;
  alert_count: number;
  dominant_severity: Severity;
  lat_center: number;
  lng_center: number;
}

interface HeatmapPanelProps {
  orgSlug: string;
  orgScore: number;
  cells: HeatmapCell[];
  computedAt: Date;
}

const SEVERITY_BG: Record<Severity, string> = {
  critical: 'bg-severity-critical/20 border-severity-critical/40 text-severity-critical',
  high:     'bg-severity-high/20 border-severity-high/40 text-severity-high',
  medium:   'bg-severity-medium/20 border-severity-medium/40 text-severity-medium',
  low:      'bg-severity-low/20 border-severity-low/40 text-severity-low',
  info:     'bg-bg-surface-3 border-border-default text-text-secondary',
};

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 75 ? 'text-severity-critical'
    : score >= 50 ? 'text-severity-high'
    : score >= 25 ? 'text-severity-medium'
    : 'text-severity-low';
  return (
    <span className={`text-3xl font-semibold font-mono tabular-nums ${color}`}>{score}</span>
  );
}

export function HeatmapPanel({ orgSlug, orgScore, cells, computedAt }: HeatmapPanelProps) {
  const topCells = cells.slice(0, 8);

  return (
    <div className="bg-bg-surface border border-border-subtle rounded-[6px] flex flex-col">
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
          Risk Heatmap
        </span>
        <Link
          href={`/app/${orgSlug}/heatmap`}
          className="text-xs text-accent hover:text-accent transition-colors duration-[150ms] ease-out"
        >
          Full view →
        </Link>
      </div>

      <div className="px-4 py-3 flex items-center gap-3 border-b border-border-subtle">
        <div>
          <div className="text-xs text-text-muted mb-0.5">Org Risk Score</div>
          <ScoreGauge score={orgScore} />
          <span className="text-text-muted text-xs"> / 100</span>
        </div>
        <div className="flex-1 h-2 bg-bg-surface-3 rounded-[4px] overflow-hidden">
          <div
            className={`h-full rounded-[4px] transition-colors duration-[150ms] ease-out ${
              orgScore >= 75 ? 'bg-severity-critical'
              : orgScore >= 50 ? 'bg-severity-high'
              : orgScore >= 25 ? 'bg-severity-medium'
              : 'bg-severity-low'
            }`}
            style={{ width: `${orgScore}%` }}
          />
        </div>
      </div>

      <div className="p-3 grid grid-cols-4 gap-1.5 flex-1">
        {topCells.length === 0 ? (
          <div className="col-span-4 flex items-center justify-center py-6 text-xs text-text-muted">
            No risk data yet — alerts appear here once entities are matched.
          </div>
        ) : (
          topCells.map(cell => (
            <div
              key={cell.region}
              className={`border rounded-[4px] p-2 flex flex-col gap-0.5 transition-colors duration-[150ms] ease-out ${SEVERITY_BG[cell.dominant_severity]}`}
              title={`${cell.region}: score ${cell.score}, ${cell.alert_count} alert${cell.alert_count !== 1 ? 's' : ''}`}
            >
              <span className="text-[10px] font-medium truncate text-text-primary">{cell.region}</span>
              <span className="text-base font-semibold font-mono tabular-nums">{cell.score}</span>
              <span className="text-[10px] text-text-muted">{cell.alert_count} alert{cell.alert_count !== 1 ? 's' : ''}</span>
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2 border-t border-border-subtle">
        <span className="text-[11px] text-text-muted font-mono">
          Updated {new Date(computedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

'use client';

// Brier score accuracy dashboard.
// Lower score = better. Perfect = 0, coin flip = 0.25, maximum miss = 1.
// Color coding: ≤0.1 green, ≤0.2 amber, >0.2 red.
// Groups resolved forecasts by indicator_type and shows per-type avg Brier.

import { ProbabilityBar } from './ProbabilityBar';

interface ForecastRecord {
  id: string;
  indicator_type: string;
  probability_pct: number;
  actual_outcome: 'occurred' | 'did_not_occur' | null;
  brier_score: number | null;
  expires_at: string | Date;
  narrative: string;
}

interface Props {
  resolvedForecasts: ForecastRecord[];
}

function groupBy(forecasts: ForecastRecord[]): Record<string, ForecastRecord[]> {
  return forecasts.reduce<Record<string, ForecastRecord[]>>((acc, f) => {
    (acc[f.indicator_type] ??= []).push(f);
    return acc;
  }, {});
}

function avgBrier(recs: ForecastRecord[]): number | null {
  const scored = recs.filter(r => r.brier_score !== null);
  if (scored.length === 0) return null;
  return scored.reduce((acc, r) => acc + (r.brier_score ?? 0), 0) / scored.length;
}

function brierClass(score: number | null): string {
  if (score === null) return 'text-text-muted';
  if (score <= 0.10)  return 'text-severity-low';
  if (score <= 0.20)  return 'text-severity-medium';
  return 'text-severity-critical';
}

function brierLabel(score: number | null): string {
  if (score === null) return '—';
  return score.toFixed(3);
}

export function AccuracyDashboard({ resolvedForecasts }: Props) {
  if (resolvedForecasts.length === 0) {
    return (
      <div className="bg-bg-surface border border-border-subtle rounded-md p-8 text-center">
        <p className="text-sm text-text-muted">
          No resolved forecasts yet. Accuracy data appears after forecast windows expire.
        </p>
      </div>
    );
  }

  const grouped   = groupBy(resolvedForecasts);
  const overallAvg = avgBrier(resolvedForecasts);
  const occurred  = resolvedForecasts.filter(f => f.actual_outcome === 'occurred').length;
  const didNot    = resolvedForecasts.filter(f => f.actual_outcome === 'did_not_occur').length;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="bg-bg-surface border border-border-subtle rounded-md p-4 flex gap-10 flex-wrap">
        <div>
          <div className="text-xs text-text-muted mb-1">Overall Brier Score</div>
          <div className={`text-lg font-mono ${brierClass(overallAvg)}`}>
            {brierLabel(overallAvg)}
          </div>
          <div className="text-xs text-text-disabled mt-0.5">
            lower is better · 0 = perfect · 0.25 = coin flip · 1 = worst miss
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">Outcomes ({resolvedForecasts.length} resolved)</div>
          <div className="flex gap-4">
            <span className="text-base text-severity-low font-mono">
              {occurred} occurred
            </span>
            <span className="text-base text-text-secondary font-mono">
              {didNot} did not occur
            </span>
          </div>
        </div>
      </div>

      {/* Per-indicator breakdown */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
        {Object.entries(grouped).map(([type, recs]) => {
          const avg = avgBrier(recs);
          const most = recs[0];
          return (
            <div
              key={type}
              className="bg-bg-surface border border-border-subtle rounded-md p-3"
            >
              <div className="text-xs text-text-muted uppercase tracking-wider mb-2">
                {type}
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className={`text-lg font-mono ${brierClass(avg)}`}>
                  {brierLabel(avg)}
                </span>
                <span className="text-xs text-text-disabled">{recs.length} resolved</span>
              </div>
              {most && (
                <>
                  <ProbabilityBar probability_pct={most.probability_pct} />
                  <p className="text-xs text-text-muted mt-1.5 overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                    {most.narrative.slice(0, 100)}{most.narrative.length > 100 ? '…' : ''}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

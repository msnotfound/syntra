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

function brierColor(score: number | null): string {
  if (score === null) return '#64748B';
  if (score <= 0.10)  return '#22C55E';
  if (score <= 0.20)  return '#EAB308';
  return '#EF4444';
}

function brierLabel(score: number | null): string {
  if (score === null) return '—';
  return score.toFixed(3);
}

export function AccuracyDashboard({ resolvedForecasts }: Props) {
  if (resolvedForecasts.length === 0) {
    return (
      <div style={{ backgroundColor: '#151921', border: '1px solid #1E2530', borderRadius: '6px', padding: '32px', textAlign: 'center' }}>
        <p style={{ color: '#64748B', fontSize: '13px' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Summary */}
      <div style={{ backgroundColor: '#151921', border: '1px solid #1E2530', borderRadius: '6px', padding: '16px', display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>Overall Brier Score</div>
          <div style={{ fontSize: '22px', fontFamily: '"Geist Mono", monospace', color: brierColor(overallAvg) }}>
            {brierLabel(overallAvg)}
          </div>
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
            lower is better · 0 = perfect · 0.25 = coin flip · 1 = worst miss
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>Outcomes ({resolvedForecasts.length} resolved)</div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span style={{ fontSize: '14px', color: '#22C55E', fontFamily: '"Geist Mono", monospace' }}>
              {occurred} occurred
            </span>
            <span style={{ fontSize: '14px', color: '#94A3B8', fontFamily: '"Geist Mono", monospace' }}>
              {didNot} did not occur
            </span>
          </div>
        </div>
      </div>

      {/* Per-indicator breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px' }}>
        {Object.entries(grouped).map(([type, recs]) => {
          const avg = avgBrier(recs);
          const most = recs[0];
          return (
            <div
              key={type}
              style={{ backgroundColor: '#151921', border: '1px solid #1E2530', borderRadius: '6px', padding: '12px' }}
            >
              <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                {type}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '20px', fontFamily: '"Geist Mono", monospace', color: brierColor(avg) }}>
                  {brierLabel(avg)}
                </span>
                <span style={{ fontSize: '12px', color: '#475569' }}>{recs.length} resolved</span>
              </div>
              {most && (
                <>
                  <ProbabilityBar probability_pct={most.probability_pct} />
                  <p style={{ fontSize: '11px', color: '#64748B', marginTop: '6px', overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 } as React.CSSProperties}>
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

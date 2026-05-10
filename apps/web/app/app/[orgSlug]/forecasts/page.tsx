import { TrendingUp } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Forecast, LeadingIndicator } from '@syntra/db';
import type { IForecast, ILeadingIndicator } from '@syntra/db';
import { ProbabilityBar } from '@/components/forecast/ProbabilityBar';
import { AccuracyDashboard } from '@/components/forecast/AccuracyDashboard';

interface PageProps {
  params: { orgSlug: string };
  searchParams: { tab?: string };
}

const INDICATOR_TYPE_LABELS: Record<string, string> = {
  'port-congestion':      'Port Congestion',
  'sanctions-likelihood': 'Sanctions Likelihood',
  'shipping-delay':       'Shipping Delay',
  'currency-shock':       'Currency Shock',
  'commodity-price':      'Commodity Price',
  'geopolitical-event':   'Geopolitical Event',
};

function ForecastBadge({ pct, horizonDays }: { pct: number; horizonDays: number }) {
  const color = pct >= 66 ? '#F97316' : pct >= 40 ? '#EAB308' : '#60A5FA';
  return (
    <span
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        gap:             '4px',
        padding:         '2px 8px',
        border:          `1.5px dashed ${color}66`,
        borderRadius:    '4px',
        fontSize:        '11px',
        fontFamily:      '"Geist Mono", monospace',
        color,
        backgroundColor: `${color}15`,
      }}
    >
      🔮 FORECAST · {pct}% · {horizonDays}d
    </span>
  );
}

const TABS = ['active', 'materialized', 'deprecated', 'accuracy'] as const;

export default async function ForecastsPage({ params, searchParams }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);
  const tab = (searchParams.tab ?? 'active') as typeof TABS[number];

  const query: Record<string, unknown> = { org_id: org._id };
  if (tab === 'active')      query.actual_outcome = null;
  if (tab === 'materialized') query.actual_outcome = 'occurred';
  if (tab === 'deprecated')   query.actual_outcome = 'did_not_occur';

  const forecasts = tab === 'accuracy'
    ? []
    : (await Forecast.find(query).sort({ probability_pct: -1, computed_at: -1 }).limit(100).lean()) as unknown as IForecast[];

  const resolvedForecasts = await Forecast.find({
    org_id:         org._id,
    actual_outcome: { $ne: null },
    brier_score:    { $ne: null },
  }).sort({ expires_at: -1 }).limit(200).lean() as unknown as IForecast[];

  const scored = resolvedForecasts.filter(f => f.brier_score !== null);
  const avgBrier = scored.length > 0
    ? scored.reduce((acc, f) => acc + (f.brier_score ?? 0), 0) / scored.length
    : null;

  const indicatorIds = [...new Set(forecasts.map(f => String(f.indicator_id)))];
  const indicators   = indicatorIds.length > 0
    ? (await LeadingIndicator.find({ _id: { $in: indicatorIds } }).lean()) as unknown as ILeadingIndicator[]
    : [];
  const indicatorMap = new Map(indicators.map(i => [String(i._id), i]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#FAFAFA' }}>Forecasts</h1>
        <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>
          {tab !== 'accuracy' ? `${forecasts.length} ${tab} forecasts` : `${resolvedForecasts.length} resolved forecasts`}
          {avgBrier !== null && ` · accuracy last 90d: Brier ${avgBrier.toFixed(2)}`}
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #1E2530' }}>
        {TABS.map(t => {
          const isActive = tab === t;
          return (
            <a
              key={t}
              href={`/app/${params.orgSlug}/forecasts?tab=${t}`}
              style={{
                padding:         '6px 16px',
                fontSize:        '13px',
                fontWeight:      isActive ? 500 : 400,
                color:           isActive ? '#FAFAFA' : '#64748B',
                borderBottom:    isActive ? '2px solid #F97316' : '2px solid transparent',
                textDecoration:  'none',
                transition:      '150ms ease-out',
                textTransform:   'capitalize',
              }}
            >
              {t === 'accuracy' ? 'Accuracy report' : t}
            </a>
          );
        })}
      </div>

      {/* Accuracy tab */}
      {tab === 'accuracy' && (
        <AccuracyDashboard
          resolvedForecasts={resolvedForecasts.map(f => ({
            id:              String(f._id),
            indicator_type:  f.indicator_type,
            probability_pct: f.probability_pct,
            actual_outcome:  f.actual_outcome,
            brier_score:     f.brier_score,
            expires_at:      f.expires_at,
            narrative:       f.narrative,
          }))}
        />
      )}

      {/* Forecast list */}
      {tab !== 'accuracy' && (
        forecasts.length === 0 ? (
          <div
            style={{
              backgroundColor: '#151921',
              border:          '1.5px dashed rgba(249,115,22,0.3)',
              borderRadius:    '6px',
              padding:         '48px',
              textAlign:       'center',
            }}
          >
            <TrendingUp size={32} style={{ color: '#475569', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '14px', fontWeight: 500, color: '#94A3B8' }}>No {tab} forecasts</p>
            <p style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
              Forecasts appear when leading indicators breach their thresholds.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {forecasts.map(forecast => {
              const indicator = indicatorMap.get(String(forecast.indicator_id));
              const label     = INDICATOR_TYPE_LABELS[forecast.indicator_type] ?? forecast.indicator_type;
              const expiresAt = new Date(forecast.expires_at);
              const daysLeft  = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 86400_000));

              return (
                <div
                  key={String(forecast._id)}
                  style={{
                    backgroundColor: '#151921',
                    border:          '1.5px dashed rgba(249,115,22,0.35)',
                    borderRadius:    '6px',
                    padding:         '16px',
                  }}
                >
                  {/* Card header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <ForecastBadge pct={forecast.probability_pct} horizonDays={forecast.time_horizon_days} />
                      <h3 style={{ fontSize: '14px', fontWeight: 500, color: '#FAFAFA', margin: 0 }}>{label}</h3>
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', fontFamily: '"Geist Mono", monospace', textAlign: 'right' }}>
                      {tab === 'active'
                        ? `expires in ${daysLeft}d`
                        : expiresAt.toLocaleDateString('en-IN')}
                    </div>
                  </div>

                  {/* Probability bar */}
                  <ProbabilityBar probability_pct={forecast.probability_pct} className="mb-3" />

                  {/* Narrative */}
                  <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '10px', lineHeight: '1.5' }}>
                    {forecast.narrative}
                  </p>

                  {/* Indicator signal */}
                  {indicator && (
                    <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>
                      <span style={{ color: '#475569' }}>Signal: </span>
                      {indicator.name}
                      {indicator.trend === 'rising'  && ' ▲'}
                      {indicator.trend === 'falling' && ' ▼'}
                      {indicator.trend === 'stable'  && ' →'}
                      {' '}
                      <span style={{ fontFamily: '"Geist Mono", monospace' }}>
                        {(indicator.current_value * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}

                  {/* Action + supporting claims count */}
                  <div style={{ borderTop: '1px solid #1E2530', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: '12px', color: '#94A3B8', flex: 1, margin: 0 }}>
                      <span style={{ color: '#64748B' }}>Action: </span>
                      {forecast.recommended_action}
                    </p>
                    {forecast.supporting_claims.length > 0 && (
                      <span style={{ fontSize: '11px', color: '#475569', marginLeft: '12px', flexShrink: 0 }}>
                        {forecast.supporting_claims.length} claim{forecast.supporting_claims.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Outcome badge (resolved forecasts only) */}
                  {forecast.actual_outcome && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize:        '11px',
                          padding:         '2px 8px',
                          borderRadius:    '4px',
                          backgroundColor: forecast.actual_outcome === 'occurred' ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.15)',
                          color:           forecast.actual_outcome === 'occurred' ? '#22C55E' : '#64748B',
                        }}
                      >
                        {forecast.actual_outcome === 'occurred' ? '✓ Materialized' : '✗ Did not occur'}
                      </span>
                      {forecast.brier_score !== null && (
                        <span style={{ fontSize: '11px', fontFamily: '"Geist Mono", monospace', color: '#475569' }}>
                          Brier: {forecast.brier_score.toFixed(3)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

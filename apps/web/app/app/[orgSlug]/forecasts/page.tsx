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
  const tone = pct >= 66 ? 'high' : pct >= 40 ? 'medium' : 'low';
  const toneClass = {
    high:   'border-severity-high/40 bg-severity-high/10 text-severity-high',
    medium: 'border-severity-medium/40 bg-severity-medium/10 text-severity-medium',
    low:    'border-severity-low/40 bg-severity-low/10 text-severity-low',
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-dashed text-xs font-mono ${toneClass}`}
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
        <h1 className="text-xl font-semibold text-text-primary">Forecasts</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {tab !== 'accuracy' ? `${forecasts.length} ${tab} forecasts` : `${resolvedForecasts.length} resolved forecasts`}
          {avgBrier !== null && ` · accuracy last 90d: Brier ${avgBrier.toFixed(2)}`}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-border-subtle">
        {TABS.map(t => {
          const isActive = tab === t;
          return (
            <a
              key={t}
              href={`/app/${params.orgSlug}/forecasts?tab=${t}`}
              className={`px-4 py-1.5 text-sm capitalize no-underline border-b-2 transition-colors duration-[150ms] ease-out active:scale-95 ${
                isActive
                  ? 'font-medium text-text-primary border-severity-high'
                  : 'font-regular text-text-muted border-transparent'
              }`}
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
            className="bg-bg-surface border border-dashed border-severity-high/30 rounded-md p-12 text-center"
          >
            <TrendingUp size={32} className="mx-auto mb-3 text-text-disabled" />
            <p className="text-base font-medium text-text-secondary">No {tab} forecasts</p>
            <p className="mt-1 text-xs text-text-muted">
              Forecasts appear when leading indicators breach their thresholds.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {forecasts.map(forecast => {
              const indicator = indicatorMap.get(String(forecast.indicator_id));
              const label     = INDICATOR_TYPE_LABELS[forecast.indicator_type] ?? forecast.indicator_type;
              const expiresAt = new Date(forecast.expires_at);
              const daysLeft  = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 86400_000));

              return (
                <div
                  key={String(forecast._id)}
                  className="bg-bg-surface border border-dashed border-severity-high/40 rounded-md p-4"
                >
                  {/* Card header */}
                  <div className="flex justify-between items-start mb-2.5">
                    <div className="flex flex-col gap-1.5">
                      <ForecastBadge pct={forecast.probability_pct} horizonDays={forecast.time_horizon_days} />
                      <h3 className="text-base font-medium text-text-primary m-0">{label}</h3>
                    </div>
                    <div className="text-xs text-text-disabled font-mono text-right">
                      {tab === 'active'
                        ? `expires in ${daysLeft}d`
                        : expiresAt.toLocaleDateString('en-IN')}
                    </div>
                  </div>

                  {/* Probability bar */}
                  <ProbabilityBar probability_pct={forecast.probability_pct} className="mb-3" />

                  {/* Narrative */}
                  <p className="text-sm text-text-secondary mb-2.5 leading-normal">
                    {forecast.narrative}
                  </p>

                  {/* Indicator signal */}
                  {indicator && (
                    <div className="text-xs text-text-muted mb-2">
                      <span className="text-text-disabled">Signal: </span>
                      {indicator.name}
                      {indicator.trend === 'rising'  && ' ▲'}
                      {indicator.trend === 'falling' && ' ▼'}
                      {indicator.trend === 'stable'  && ' →'}
                      {' '}
                      <span className="font-mono">
                        {(indicator.current_value * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}

                  {/* Action + supporting claims count */}
                  <div className="border-t border-border-subtle pt-2.5 flex justify-between items-center">
                    <p className="text-xs text-text-secondary flex-1 m-0">
                      <span className="text-text-muted">Action: </span>
                      {forecast.recommended_action}
                    </p>
                    {forecast.supporting_claims.length > 0 && (
                      <span className="text-xs text-text-disabled ml-3 flex-shrink-0">
                        {forecast.supporting_claims.length} claim{forecast.supporting_claims.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Outcome badge (resolved forecasts only) */}
                  {forecast.actual_outcome && (
                    <div className="mt-2 flex gap-2 items-center">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-sm ${
                          forecast.actual_outcome === 'occurred'
                            ? 'bg-severity-low/10 text-severity-low'
                            : 'bg-text-muted/15 text-text-muted'
                        }`}
                      >
                        {forecast.actual_outcome === 'occurred' ? '✓ Materialized' : '✗ Did not occur'}
                      </span>
                      {forecast.brier_score !== null && (
                        <span className="text-xs font-mono text-text-disabled">
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

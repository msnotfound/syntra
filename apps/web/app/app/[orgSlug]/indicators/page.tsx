import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Forecast, LeadingIndicator } from '@syntra/db';
import type { IForecast, ILeadingIndicator } from '@syntra/db';
import { CalibrationDashboard } from '@/components/forecast/CalibrationDashboard';

interface PageProps {
  params: { orgSlug: string };
  searchParams: { breach?: string };
}

const BREACH_STYLE: Record<string, { text: string; border: string; bg: string }> = {
  normal:   { text: 'text-severity-low',      border: 'border-severity-low/25',      bg: 'bg-severity-low/10' },
  elevated: { text: 'text-severity-medium',   border: 'border-severity-medium/25',   bg: 'bg-severity-medium/10' },
  critical: { text: 'text-severity-critical', border: 'border-severity-critical/25', bg: 'bg-severity-critical/10' },
};

function TrendArrow({ trend }: { trend: string }) {
  if (trend === 'rising')  return <span className="text-severity-high">▲</span>;
  if (trend === 'falling') return <span className="text-severity-low">▼</span>;
  return <span className="text-text-muted">→</span>;
}

function SparkBar({ value, baseline }: { value: number; baseline: number }) {
  const vPct = Math.min(100, value   * 100);
  const bPct = Math.min(100, baseline * 100);
  const isAboveBaseline = vPct > bPct + 5;
  return (
    <div className="relative h-7 bg-bg-surface-2 rounded-sm overflow-hidden">
      {/* Baseline marker */}
      <div
        className="absolute top-0 bottom-0 w-px bg-accent opacity-50"
        style={{
          // dynamic — token cast required
          left: `${bPct}%`,
        }}
      />
      {/* Current-value bar */}
      <div
        className={`absolute left-0 top-1/4 h-1/2 rounded-r-sm transition-colors duration-[150ms] ease-out ${
          isAboveBaseline ? 'bg-severity-high' : 'bg-accent'
        }`}
        style={{
          // dynamic — token cast required
          width:           `${vPct}%`,
        }}
      />
    </div>
  );
}

function IndicatorCard({ indicator }: { indicator: ILeadingIndicator }) {
  const bs = BREACH_STYLE[indicator.threshold_breach] ?? BREACH_STYLE.normal;
  return (
    <div
      className={`bg-bg-surface border ${bs.border} rounded-md p-3.5 flex flex-col gap-2.5`}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="text-xs font-mono text-text-secondary mb-1">
            {indicator.name}
          </div>
          <span
            className={`text-xs px-1.5 py-0.5 rounded-sm ${bs.bg} ${bs.text} uppercase tracking-wider`}
          >
            {indicator.threshold_breach}
          </span>
        </div>
        <div className="text-right">
          <div className={`text-lg font-mono ${bs.text}`}>
            {(indicator.current_value * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-text-muted">
            <TrendArrow trend={indicator.trend} />
          </div>
        </div>
      </div>

      <SparkBar value={indicator.current_value} baseline={indicator.baseline_value} />

      <p className="text-xs text-text-muted leading-normal m-0">
        {indicator.description}
      </p>

      <div className="flex justify-between text-xs text-text-disabled flex-wrap gap-1">
        <span className="font-mono">
          baseline {(indicator.baseline_value * 100).toFixed(0)}% · σ {indicator.sigma.toFixed(3)}
        </span>
        <span className="text-right">
          {indicator.source_modules.join(' + ')}
        </span>
      </div>
    </div>
  );
}

const BREACH_FILTERS: Array<{ value: string; label: string; color?: string }> = [
  { value: '',         label: 'All' },
  { value: 'critical', label: 'Critical', color: 'text-severity-critical' },
  { value: 'elevated', label: 'Elevated', color: 'text-severity-medium' },
  { value: 'normal',   label: 'Normal',   color: 'text-severity-low' },
];

export default async function IndicatorsPage({ params, searchParams }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const breach = searchParams.breach ?? '';
  const query: Record<string, unknown> = {};
  if (breach && ['normal','elevated','critical'].includes(breach)) query.threshold_breach = breach;

  const indicators = await LeadingIndicator.find(query)
    .sort({ threshold_breach: -1, name: 1 })
    .lean() as unknown as ILeadingIndicator[];

  const total    = await LeadingIndicator.countDocuments({});
  const critical = await LeadingIndicator.countDocuments({ threshold_breach: 'critical' });
  const elevated = await LeadingIndicator.countDocuments({ threshold_breach: 'elevated' });
  const resolvedForecasts = await Forecast.find({
    org_id:         org._id,
    actual_outcome: { $ne: null },
    brier_score:    { $ne: null },
  }).sort({ expires_at: -1 }).limit(300).lean() as unknown as IForecast[];

  const countMap: Record<string, number> = { '': total, critical, elevated, normal: total - critical - elevated };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Leading Indicators</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {total} indicators · {critical} critical · {elevated} elevated
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {BREACH_FILTERS.map(f => {
          const isActive = breach === f.value;
          return (
            <a
              key={f.value}
              href={f.value ? `/app/${params.orgSlug}/indicators?breach=${f.value}` : `/app/${params.orgSlug}/indicators`}
              className={`px-3 py-1 rounded-sm text-xs font-medium border no-underline transition-colors duration-[150ms] ease-out active:scale-95 ${
                isActive
                  ? 'border-accent bg-bg-surface-3 text-text-primary'
                  : `border-border-default bg-bg-surface-2 ${f.color ?? 'text-text-secondary'}`
              }`}
            >
              {f.label}
              {' '}
              <span className="font-mono text-text-disabled text-xs">
                {countMap[f.value] ?? ''}
              </span>
            </a>
          );
        })}
      </div>

      {/* Indicator grid */}
      {indicators.length === 0 ? (
        <div
          className="bg-bg-surface border border-border-subtle rounded-md p-12 text-center"
        >
          <p className="text-base text-text-secondary">No indicators match filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2.5">
          {indicators.map(ind => <IndicatorCard key={String(ind._id)} indicator={ind} />)}
        </div>
      )}

      <CalibrationDashboard
        forecasts={resolvedForecasts.map(f => ({
          id:              String(f._id),
          indicator_type:  f.indicator_type,
          probability_pct: f.probability_pct,
          actual_outcome:  f.actual_outcome,
          brier_score:     f.brier_score,
          expires_at:      f.expires_at,
        }))}
      />
    </div>
  );
}

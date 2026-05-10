import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { LeadingIndicator } from '@syntra/db';
import type { ILeadingIndicator } from '@syntra/db';

interface PageProps {
  params: { orgSlug: string };
  searchParams: { breach?: string };
}

const BREACH_STYLE: Record<string, { text: string; border: string; bg: string }> = {
  normal:   { text: '#60A5FA', border: 'rgba(96,165,250,0.25)',  bg: 'rgba(96,165,250,0.06)'  },
  elevated: { text: '#EAB308', border: 'rgba(234,179,8,0.25)',   bg: 'rgba(234,179,8,0.06)'   },
  critical: { text: '#EF4444', border: 'rgba(239,68,68,0.25)',   bg: 'rgba(239,68,68,0.06)'   },
};

function TrendArrow({ trend }: { trend: string }) {
  if (trend === 'rising')  return <span style={{ color: '#F97316' }}>▲</span>;
  if (trend === 'falling') return <span style={{ color: '#22C55E' }}>▼</span>;
  return <span style={{ color: '#64748B' }}>→</span>;
}

function SparkBar({ value, baseline }: { value: number; baseline: number }) {
  const vPct = Math.min(100, value   * 100);
  const bPct = Math.min(100, baseline * 100);
  return (
    <div style={{ position: 'relative', height: '28px', backgroundColor: '#1E2530', borderRadius: '4px', overflow: 'hidden' }}>
      {/* Baseline marker */}
      <div style={{ position: 'absolute', left: `${bPct}%`, top: 0, bottom: 0, width: '1px', backgroundColor: '#3B82F6', opacity: 0.5 }} />
      {/* Current-value bar */}
      <div
        style={{
          position:        'absolute',
          left:            0,
          top:             '25%',
          height:          '50%',
          width:           `${vPct}%`,
          backgroundColor: vPct > bPct + 5 ? '#F97316' : '#3B82F6',
          borderRadius:    '0 2px 2px 0',
          transition:      '150ms ease-out',
        }}
      />
    </div>
  );
}

function IndicatorCard({ indicator }: { indicator: ILeadingIndicator }) {
  const bs = BREACH_STYLE[indicator.threshold_breach] ?? BREACH_STYLE.normal;
  return (
    <div
      style={{
        backgroundColor: '#151921',
        border:          `1px solid ${bs.border}`,
        borderRadius:    '6px',
        padding:         '14px',
        display:         'flex',
        flexDirection:   'column',
        gap:             '10px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '12px', fontFamily: '"Geist Mono", monospace', color: '#94A3B8', marginBottom: '4px' }}>
            {indicator.name}
          </div>
          <span
            style={{
              fontSize:        '10px',
              padding:         '2px 6px',
              borderRadius:    '4px',
              backgroundColor: bs.bg,
              color:           bs.text,
              textTransform:   'uppercase',
              letterSpacing:   '0.06em',
            }}
          >
            {indicator.threshold_breach}
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '22px', fontFamily: '"Geist Mono", monospace', color: bs.text }}>
            {(indicator.current_value * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: '12px', color: '#64748B' }}>
            <TrendArrow trend={indicator.trend} />
          </div>
        </div>
      </div>

      <SparkBar value={indicator.current_value} baseline={indicator.baseline_value} />

      <p style={{ fontSize: '11px', color: '#64748B', lineHeight: '1.45', margin: 0 }}>
        {indicator.description}
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#475569', flexWrap: 'wrap', gap: '4px' }}>
        <span style={{ fontFamily: '"Geist Mono", monospace' }}>
          baseline {(indicator.baseline_value * 100).toFixed(0)}% · σ {indicator.sigma.toFixed(3)}
        </span>
        <span style={{ textAlign: 'right' }}>
          {indicator.source_modules.join(' + ')}
        </span>
      </div>
    </div>
  );
}

const BREACH_FILTERS: Array<{ value: string; label: string; color?: string }> = [
  { value: '',         label: 'All' },
  { value: 'critical', label: 'Critical', color: '#EF4444' },
  { value: 'elevated', label: 'Elevated', color: '#EAB308' },
  { value: 'normal',   label: 'Normal',   color: '#60A5FA' },
];

export default async function IndicatorsPage({ params, searchParams }: PageProps) {
  await ensureDb();
  await getOrgBySlugOrThrow(params.orgSlug);

  const breach = searchParams.breach ?? '';
  const query: Record<string, unknown> = {};
  if (breach && ['normal','elevated','critical'].includes(breach)) query.threshold_breach = breach;

  const indicators = await LeadingIndicator.find(query)
    .sort({ threshold_breach: -1, name: 1 })
    .lean() as unknown as ILeadingIndicator[];

  const total    = await LeadingIndicator.countDocuments({});
  const critical = await LeadingIndicator.countDocuments({ threshold_breach: 'critical' });
  const elevated = await LeadingIndicator.countDocuments({ threshold_breach: 'elevated' });

  const countMap: Record<string, number> = { '': total, critical, elevated, normal: total - critical - elevated };

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#FAFAFA' }}>Leading Indicators</h1>
        <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>
          {total} indicators · {critical} critical · {elevated} elevated
        </p>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {BREACH_FILTERS.map(f => {
          const isActive = breach === f.value;
          return (
            <a
              key={f.value}
              href={f.value ? `/app/${params.orgSlug}/indicators?breach=${f.value}` : `/app/${params.orgSlug}/indicators`}
              style={{
                padding:         '4px 12px',
                borderRadius:    '4px',
                fontSize:        '12px',
                fontWeight:      500,
                border:          isActive ? '1px solid #3B82F6' : '1px solid #262C36',
                backgroundColor: isActive ? '#262C36' : '#1E2530',
                color:           isActive ? '#FAFAFA' : (f.color ?? '#94A3B8'),
                textDecoration:  'none',
                transition:      '150ms ease-out',
              }}
            >
              {f.label}
              {' '}
              <span style={{ fontFamily: '"Geist Mono", monospace', color: '#475569', fontSize: '11px' }}>
                {countMap[f.value] ?? ''}
              </span>
            </a>
          );
        })}
      </div>

      {/* Indicator grid */}
      {indicators.length === 0 ? (
        <div
          style={{ backgroundColor: '#151921', border: '1px solid #1E2530', borderRadius: '6px', padding: '48px', textAlign: 'center' }}
        >
          <p style={{ fontSize: '14px', color: '#94A3B8' }}>No indicators match filter.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
          {indicators.map(ind => <IndicatorCard key={String(ind._id)} indicator={ind} />)}
        </div>
      )}
    </div>
  );
}

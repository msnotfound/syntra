import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, TrendingUp } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Forecast, IntelClaim, SourceReliability, LeadingIndicator } from '@syntra/db';
import type { IForecast, IIntelClaim, ISourceReliability, ILeadingIndicator } from '@syntra/db';
import { ProbabilityBar } from '@/components/forecast/ProbabilityBar';
import { ProvenanceTrail } from '@/components/intel/ProvenanceTrail';
import type { ProvenanceClaim } from '@/components/intel/ProvenanceTrail';
import { SourceBadge } from '@/components/intel/SourceBadge';
import type { AdmiraltyCode } from '@/components/intel/SourceBadge';
import { ForecastClaimGraph } from './ForecastClaimGraph';
import type { ClaimNodeData } from './ForecastClaimGraph';

interface PageProps {
  params: { orgSlug: string; id: string };
}

const INDICATOR_TYPE_LABELS: Record<string, string> = {
  'port-congestion':      'Port Congestion',
  'sanctions-likelihood': 'Sanctions Likelihood',
  'shipping-delay':       'Shipping Delay',
  'currency-shock':       'Currency Shock',
  'commodity-price':      'Commodity Price',
  'geopolitical-event':   'Geopolitical Event',
};

export default async function ForecastDetailPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const forecast = await Forecast.findOne({ _id: params.id, org_id: org._id }).lean() as unknown as IForecast | null;
  if (!forecast) notFound();

  const indicator = await LeadingIndicator.findById(forecast.indicator_id).lean() as unknown as ILeadingIndicator | null;

  // Fetch all supporting claims
  const claimIds = forecast.supporting_claims ?? [];
  const claims = claimIds.length > 0
    ? (await IntelClaim.find({ _id: { $in: claimIds } }).lean() as unknown as IIntelClaim[])
    : [];

  // Fetch all parent claims transitively (one extra level for chain depth)
  const parentClaimIds = claims.flatMap(c => c.parent_claim_ids ?? []);
  const parentClaims = parentClaimIds.length > 0
    ? (await IntelClaim.find({ _id: { $in: parentClaimIds } }).lean() as unknown as IIntelClaim[])
    : [];

  const allClaims = [...claims, ...parentClaims.filter(
    pc => !claims.some(c => String(c._id) === String(pc._id)),
  )];

  // Fetch sources for all claims
  const sourceIds = [...new Set(allClaims.map(c => String(c.source_id)))];
  const sources = sourceIds.length > 0
    ? (await SourceReliability.find({ _id: { $in: sourceIds } }).lean() as unknown as ISourceReliability[])
    : [];
  const sourceMap = new Map(sources.map(s => [String(s._id), s]));

  // Serialize claims for client components
  function toProvenanceClaim(c: IIntelClaim, depth: number): ProvenanceClaim {
    const src = sourceMap.get(String(c.source_id)) ?? null;
    return {
      claim_id: String(c._id),
      claim_text: c.claim_text,
      claim_type: c.claim_type,
      evidence_url: c.evidence_url,
      asserted_at: c.asserted_at.toISOString(),
      parent_claim_ids: (c.parent_claim_ids ?? []).map(id => String(id)),
      depth,
      source: src ? {
        source_id: String(src._id),
        source_name: src.source_name,
        admiralty_code: src.admiralty_code,
        reliability_pct: src.reliability_pct,
      } : null,
    };
  }

  const trailClaims = allClaims.map(c => {
    const depth = claims.some(tc => String(tc._id) === String(c._id)) ? 0 : 1;
    return toProvenanceClaim(c, depth);
  });

  // Build graph data
  const graphClaims: ClaimNodeData[] = allClaims.map(c => {
    const src = sourceMap.get(String(c.source_id)) ?? null;
    return {
      claim_id: String(c._id),
      claim_text: c.claim_text,
      claim_type: c.claim_type,
      asserted_at: c.asserted_at.toISOString(),
      source_name: src?.source_name ?? null,
      admiralty_code: (src?.admiralty_code ?? null) as AdmiraltyCode | null,
      reliability_pct: src?.reliability_pct ?? null,
      evidence_url: c.evidence_url,
      is_root: false,
    };
  });

  const forecastNodeId = `forecast-${String(forecast._id)}`;
  const graphEdges = [
    // forecast → top-level supporting claims
    ...claims.map(c => ({
      id: `${forecastNodeId}->${String(c._id)}`,
      source: forecastNodeId,
      target: String(c._id),
    })),
    // parent claim edges
    ...allClaims.flatMap(c =>
      (c.parent_claim_ids ?? []).map(pid => ({
        id: `${String(c._id)}->${String(pid)}`,
        source: String(c._id),
        target: String(pid),
      }))
    ),
  ];

  const label = INDICATOR_TYPE_LABELS[forecast.indicator_type] ?? forecast.indicator_type;
  const expiresAt = new Date(forecast.expires_at);
  const daysLeft = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 86400_000));
  const isResolved = forecast.actual_outcome !== null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-text-muted">
        <Link
          href={`/app/${params.orgSlug}/forecasts`}
          className="hover:text-text-secondary transition-colors duration-[150ms]"
        >
          Forecasts
        </Link>
        <ChevronRight size={14} />
        <span className="text-text-secondary truncate max-w-md">{label}</span>
      </nav>

      {/* Header card */}
      <div className="bg-bg-surface border border-dashed border-severity-high/40 rounded-md p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border border-dashed border-severity-high/40 bg-severity-high/10 text-severity-high text-xs font-mono">
                <TrendingUp size={11} />
                FORECAST
              </span>
              <span className="text-xs font-mono text-text-muted">
                {forecast.probability_pct}% probability · {forecast.time_horizon_days}d horizon
              </span>
            </div>
            <h1 className="text-xl font-semibold text-text-primary">{label}</h1>
            {indicator && (
              <div className="mt-1 text-sm text-text-muted">
                Signal: <span className="text-text-secondary">{indicator.name}</span>
                {indicator.trend === 'rising' && ' ▲'}
                {indicator.trend === 'falling' && ' ▼'}
                {indicator.trend === 'stable' && ' →'}
                <span className="font-mono ml-1">{(indicator.current_value * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-xs text-text-muted font-mono">
              {isResolved
                ? expiresAt.toLocaleDateString('en-IN')
                : `expires in ${daysLeft}d`}
            </div>
            {forecast.actual_outcome && (
              <div className={`mt-1 text-xs px-2 py-0.5 inline-block rounded-sm ${
                forecast.actual_outcome === 'occurred'
                  ? 'bg-severity-low/10 text-severity-low'
                  : 'bg-text-muted/15 text-text-muted'
              }`}>
                {forecast.actual_outcome === 'occurred' ? '✓ Materialized' : '✗ Did not occur'}
              </div>
            )}
            {forecast.brier_score !== null && (
              <div className="mt-1 text-xs font-mono text-text-disabled">
                Brier: {forecast.brier_score.toFixed(3)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Probability + Narrative */}
      <div className="grid grid-cols-[1fr_280px] gap-4">
        <div className="space-y-4">
          {/* Probability bar */}
          <div className="bg-bg-surface border border-border-subtle rounded-md p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-3">
              Probability
            </div>
            <ProbabilityBar probability_pct={forecast.probability_pct} />
            <div className="mt-2 text-2xl font-semibold font-mono text-text-primary">
              {forecast.probability_pct}%
            </div>
          </div>

          {/* Narrative */}
          <div className="bg-bg-surface border border-border-subtle rounded-md">
            <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Narrative
              </span>
              <span className="text-xs text-text-muted bg-bg-surface-2 px-2 py-0.5 rounded-sm font-mono">
                AI-generated · {claims.length} supporting claim{claims.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="p-5">
              <p className="text-sm text-text-primary leading-relaxed border-l border-accent/60 pl-4">
                {forecast.narrative}
              </p>
            </div>
          </div>

          {/* Recommended action */}
          <div className="bg-bg-surface border border-border-subtle rounded-md p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-3">
              Recommended Action
            </div>
            <p className="text-sm text-text-primary">{forecast.recommended_action}</p>
          </div>
        </div>

        {/* Metadata sidebar */}
        <div className="space-y-3">
          <div className="bg-bg-surface border border-border-subtle rounded-md p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-3">
              Metadata
            </div>
            <div className="space-y-2">
              {[
                ['Type', label],
                ['Horizon', `${forecast.time_horizon_days} days`],
                ['Computed', new Date(forecast.computed_at).toLocaleDateString('en-IN')],
                ['Expires', expiresAt.toLocaleDateString('en-IN')],
                ['Methodology', forecast.methodology],
                ['Claims', String(claims.length)],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-xs text-text-muted uppercase tracking-wider">{k}</div>
                  <div className="text-sm text-text-primary font-mono mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Source quality summary */}
          {sources.length > 0 && (
            <div className="bg-bg-surface border border-border-subtle rounded-md p-4">
              <div className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-3">
                Source Quality
              </div>
              <div className="flex flex-col gap-2">
                {sources.slice(0, 5).map(src => (
                  <div key={String(src._id)} className="flex items-center gap-2">
                    <SourceBadge
                      admiralty_code={src.admiralty_code as AdmiraltyCode}
                      reliability_pct={src.reliability_pct}
                      source_name={src.source_name}
                    />
                    <span className="text-xs text-text-secondary">{src.source_name}</span>
                  </div>
                ))}
                {sources.length > 5 && (
                  <span className="text-xs text-text-muted font-mono">
                    +{sources.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Claim Graph */}
      <div className="bg-bg-surface border border-border-subtle rounded-md">
        <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            Claim Graph
          </span>
          <span className="text-xs text-text-muted font-mono">
            {graphClaims.length} node{graphClaims.length !== 1 ? 's' : ''} · {graphEdges.length} edge{graphEdges.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ height: 420 }}>
          <ForecastClaimGraph
            forecastId={forecastNodeId}
            forecastLabel={label}
            probability_pct={forecast.probability_pct}
            claims={graphClaims}
            edges={graphEdges}
          />
        </div>
      </div>

      {/* Provenance Trail */}
      {trailClaims.length > 0 && (
        <div className="bg-bg-surface border border-border-subtle rounded-md">
          <div className="px-5 py-3 border-b border-border-subtle">
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
              Provenance Trail
            </span>
          </div>
          <div className="p-5">
            <ProvenanceTrail claims={trailClaims} />
          </div>
        </div>
      )}
    </div>
  );
}

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, CheckCircle, Share2, TrendingDown, Lightbulb, CheckCircle2, XCircle, GitBranch } from 'lucide-react';
import { LogDecisionModal } from '@/components/decisions/LogDecisionModal';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Alert, WatchlistEntity, User, Exposure, MitigationSuggestion, IntelClaim, SourceReliability } from '@syntra/db';
import { SeverityBadge } from '@syntra/ui/components/SeverityBadge';
import { EntityChip } from '@syntra/ui/components/EntityChip';
import { TimeAgo } from '@syntra/ui/components/TimeAgo';
import { WorldMap } from '@/components/map/WorldMap';
import { TriageControls } from '@/components/triage/TriageControls';
import { CommentThread } from '@/components/triage/CommentThread';
import { StartWarRoomButton } from '@/components/warroom/StartWarRoomButton';
import { GenerateBriefButton } from '@/components/briefs/GenerateBriefButton';
import { Provenance } from '@/components/intel/Provenance';
import { SourceBadge } from '@/components/intel/SourceBadge';
import { ProvenanceTrail } from '@/components/intel/ProvenanceTrail';
import type { ProvenanceClaim } from '@/components/intel/ProvenanceTrail';
import type { AdmiraltyCode } from '@/components/intel/SourceBadge';
import type { IAlert, IWatchlistEntity, IUser, IExposure, IMitigationSuggestion, IIntelClaim, ISourceReliability } from '@syntra/db';
import type { Severity, EntityType } from '@syntra/shared';

interface PageProps { params: { orgSlug: string; id: string } }

export default async function AlertDetailPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const alert = await Alert.findOne({ _id: params.id, org_id: org._id }).lean() as unknown as IAlert | null;
  if (!alert) notFound();

  const entities = await WatchlistEntity.find({
    _id: { $in: alert.watchlist_entity_ids },
  }).lean() as unknown as IWatchlistEntity[];

  const members = await User.find({ org_id: org._id }).lean() as unknown as IUser[];

  const exposures = await Exposure.find({
    alert_id: alert._id,
    org_id: org._id,
  }).lean() as unknown as IExposure[];

  const totalVarUsd = exposures.reduce((sum, e) => sum + e.var_value_usd, 0);

  const mitigations = await MitigationSuggestion.find({
    alert_id: alert._id,
    org_id: org._id,
  }).sort({ created_at: -1 }).lean() as unknown as IMitigationSuggestion[];

  const rawClaims = await IntelClaim.find({ alert_id: alert._id })
    .sort({ created_at: 1 })
    .lean() as unknown as IIntelClaim[];

  const claimSourceIds = [...new Set(rawClaims.map(c => String(c.source_id)))];
  const claimSources = claimSourceIds.length > 0
    ? (await SourceReliability.find({ _id: { $in: claimSourceIds } }).lean() as unknown as ISourceReliability[])
    : [];
  const claimSourceMap = new Map(claimSources.map(s => [String(s._id), s]));

  const provenanceClaims: ProvenanceClaim[] = rawClaims.map((c, i) => {
    const src = claimSourceMap.get(String(c.source_id)) ?? null;
    return {
      claim_id: String(c._id),
      claim_text: c.claim_text,
      claim_type: c.claim_type,
      evidence_url: c.evidence_url,
      asserted_at: c.asserted_at.toISOString(),
      parent_claim_ids: (c.parent_claim_ids ?? []).map(id => String(id)),
      depth: i,
      source: src ? {
        source_id: String(src._id),
        source_name: src.source_name,
        admiralty_code: src.admiralty_code,
        reliability_pct: src.reliability_pct,
      } : null,
    };
  });

  const memberList = members.map(m => ({
    id: String(m._id),
    name: m.name,
    email: m.email,
  }));

  const initialComments = (alert.comments ?? []).map(c => {
    const author = members.find(m => String(m._id) === String(c.user_id));
    return {
      user_id: String(c.user_id),
      body: c.body,
      created_at: c.created_at,
      user_name: author?.name,
    };
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-text-muted">
        <Link href={`/app/${params.orgSlug}/alerts`} className="hover:text-text-secondary transition-colors duration-[150ms]">Alerts</Link>
        <ChevronRight size={14} />
        <span className="text-text-secondary truncate max-w-md">{alert.event_snapshot.title}</span>
      </nav>

      {/* Header */}
      <div className="bg-bg-surface border border-border-subtle rounded-md p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <SeverityBadge severity={alert.severity as Severity} />
              <h1 className="truncate text-xl font-semibold text-text-primary">{alert.event_snapshot.title}</h1>
              <div className="ml-auto hidden font-mono text-xs text-text-muted xl:block">
                {new Date(alert.event_snapshot.occurred_at).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
              <span>{alert.event_snapshot.country}</span>
              <span className="text-text-muted">·</span>
              <TimeAgo date={new Date(alert.event_snapshot.occurred_at)} className="font-mono text-text-muted text-xs" />
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1.5">
            {!alert.acknowledged_at && (
              <form action={`/api/v1/alerts/${String(alert._id)}/acknowledge`} method="POST">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-quick ease-out active:scale-95"
                >
                  <CheckCircle size={14} />
                  Acknowledge
                </button>
              </form>
            )}
            <button className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-bg-surface-2 border border-border-default text-text-primary hover:bg-bg-surface-3 transition-colors duration-quick ease-out active:scale-95">
              <Share2 size={14} />
              Forward
            </button>
            <GenerateBriefButton alertId={String(alert._id)} orgSlug={params.orgSlug} />
            {alert.severity === 'critical' && (
              <StartWarRoomButton
                alertId={String(alert._id)}
                alertTitle={alert.event_snapshot.title}
                orgSlug={params.orgSlug}
              />
            )}
            <LogDecisionModal alertId={String(alert._id)} orgSlug={params.orgSlug} />
          </div>
        </div>
        {alert.acknowledged_at && (
          <div className="mt-3 pt-3 border-t border-border-subtle flex items-center gap-1.5 text-xs text-text-muted">
            <CheckCircle size={12} className="text-success" />
            <span>Acknowledged <TimeAgo date={new Date(alert.acknowledged_at)} /></span>
          </div>
        )}
      </div>

      {/* Map + Why this matters */}
      <div className="grid grid-cols-[3fr_2fr] gap-4">
        <div className="aspect-[16/9] overflow-hidden rounded-md border border-border-subtle bg-bg-surface">
          <WorldMap
            watchlistPins={entities
              .filter(e => e.latitude !== null && e.longitude !== null)
              .map(e => ({ id: String(e._id), lat: e.latitude!, lng: e.longitude!, name: e.name, type: e.type }))}
            eventPins={[{
              id: String(alert._id),
              lat: alert.event_snapshot.location.lat,
              lng: alert.event_snapshot.location.lng,
              severity: alert.severity,
              title: alert.event_snapshot.title,
            }]}
            center={[alert.event_snapshot.location.lng, alert.event_snapshot.location.lat]}
            zoom={5}
            height="100%"
          />
        </div>

        <div className="bg-bg-surface border border-border-subtle rounded-md p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-4">Why This Matters To You</div>
          {alert.llm_context.why_matters && (
            <p className="mb-5 border-l border-accent/60 pl-4 text-md leading-7 text-text-primary">
              <Provenance claims={provenanceClaims} context="Why this matters">
                {alert.llm_context.why_matters}
              </Provenance>
            </p>
          )}
          <div className="space-y-3">
            {entities.map(e => (
              <div key={String(e._id)} className="flex items-start gap-2">
                <EntityChip type={e.type as EntityType} name={e.name} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Event details + Triage panel */}
      <div className="grid grid-cols-[1fr_280px] gap-4">
        <div className="space-y-4">
          {/* Event details */}
          <div className="bg-bg-surface border border-border-subtle rounded-md">
            <div className="px-5 py-3 border-b border-border-subtle">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Event Details</span>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              {[
                ['Type', alert.event_snapshot.event_type ?? 'Unknown'],
                ['Time', new Date(alert.event_snapshot.occurred_at).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC'],
                ['Coordinates', alert.event_snapshot.location
                  ? `${alert.event_snapshot.location.lat.toFixed(4)}°N, ${alert.event_snapshot.location.lng.toFixed(4)}°E`
                  : '—'],
                ['Country', alert.event_snapshot.country],
                ['Match reasons', alert.match_reasons.join(', ')],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-text-muted uppercase tracking-wider mb-0.5">{label}</div>
                  <div className="text-sm text-text-primary font-mono">{value}</div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4">
              <div className="text-xs text-text-muted uppercase tracking-wider mb-2">Description</div>
              <p className="text-sm text-text-secondary">{alert.event_snapshot.description}</p>
            </div>
          </div>

          {/* Recommended actions */}
          {alert.llm_context.recommended_actions.length > 0 && (
            <div className="bg-bg-surface border border-border-subtle rounded-md">
              <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Recommended Actions</span>
                <span className="text-xs text-text-muted bg-bg-surface-2 px-2 py-0.5 rounded-sm font-mono">AI-generated</span>
              </div>
              <ul className="p-5 space-y-2">
                {alert.llm_context.recommended_actions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                    <span className="text-accent mt-0.5">•</span>
                    <Provenance claims={provenanceClaims} context={`Recommended action ${i + 1}`}>
                      {action}
                    </Provenance>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sources */}
          {alert.event_snapshot.sources.length > 0 && (
            <div className="bg-bg-surface border border-border-subtle rounded-md">
              <div className="px-5 py-3 border-b border-border-subtle">
                <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Sources</span>
              </div>
              <div className="p-5 space-y-2">
                {alert.event_snapshot.sources.map((src, i) => {
                  const matchedSource = claimSources.find(cs =>
                    cs.source_name.toLowerCase().includes(src.name.toLowerCase()) ||
                    src.name.toLowerCase().includes(cs.source_name.toLowerCase())
                  );
                  return (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent transition-colors duration-[150ms] ease-out"
                    >
                      {matchedSource ? (
                        <SourceBadge
                          admiralty_code={matchedSource.admiralty_code as AdmiraltyCode}
                          reliability_pct={matchedSource.reliability_pct}
                          source_name={matchedSource.source_name}
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-sm bg-bg-surface-2 flex items-center justify-center text-xs font-mono text-text-muted flex-shrink-0">
                          {src.name.charAt(0)}
                        </div>
                      )}
                      <span className="font-medium">{src.name}</span>
                      <span className="text-text-muted">→</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comment thread */}
          <div className="bg-bg-surface border border-border-subtle rounded-md p-5">
            <CommentThread
              alertId={String(alert._id)}
              orgSlug={params.orgSlug}
              initialComments={initialComments}
            />
          </div>
        </div>

        {/* Triage controls sidebar */}
        <div className="bg-bg-surface border border-border-subtle rounded-md p-4 self-start sticky top-6">
          <div className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-4">Triage</div>
          <TriageControls
            alertId={String(alert._id)}
            currentStatus={(alert.status ?? 'open') as 'open' | 'triaged' | 'closed'}
            currentAssigneeId={alert.assignee_user_id ? String(alert.assignee_user_id) : null}
            members={memberList}
          />
        </div>
      </div>

      {/* Suggested Mitigations */}
      {mitigations.length > 0 && (
        <div className="bg-bg-surface border border-border-subtle rounded-md">
          <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-2">
            <Lightbulb size={14} className="text-accent" />
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Suggested Mitigations</span>
            <span className="ml-auto text-xs font-mono text-text-muted bg-bg-surface-2 px-2 py-0.5 rounded-sm">AI-generated</span>
          </div>
          <div className="divide-y divide-border-subtle">
            {mitigations.map(m => {
              const typeLabel: Record<string, string> = {
                alt_route: 'Alt Route',
                alt_supplier: 'Alt Supplier',
                inventory_buffer: 'Inventory Buffer',
                contract_clause: 'Contract Clause',
              };
              const statusClass: Record<string, string> = {
                proposed: 'text-text-secondary',
                accepted: 'text-success',
                rejected: 'text-severity-critical',
              };
              return (
                <div key={String(m._id)} className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-sm bg-bg-surface-2 text-text-secondary">
                        {typeLabel[m.suggestion_type] ?? m.suggestion_type}
                      </span>
                      <span className={`text-xs font-mono ${statusClass[m.status] ?? 'text-text-secondary'}`}>
                        {m.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {m.status === 'proposed' && (
                        <>
                          <form action={`/api/v1/alerts/${String(alert._id)}/mitigations/${String(m._id)}`} method="PATCH">
                            <input type="hidden" name="status" value="accepted" />
                            <button
                              type="submit"
                              className="flex items-center gap-1 px-2.5 h-7 rounded-sm text-xs font-medium border border-success/20 bg-success/10 text-success transition-colors duration-quick ease-out hover:bg-success/15 active:scale-95"
                            >
                              <CheckCircle2 size={12} /> Accept
                            </button>
                          </form>
                          <form action={`/api/v1/alerts/${String(alert._id)}/mitigations/${String(m._id)}`} method="PATCH">
                            <input type="hidden" name="status" value="rejected" />
                            <button
                              type="submit"
                              className="flex items-center gap-1 px-2.5 h-7 rounded-sm text-xs font-medium border border-border-default bg-bg-surface-2 text-text-secondary transition-colors duration-quick ease-out hover:bg-bg-surface-3 hover:text-text-primary active:scale-95"
                            >
                              <XCircle size={12} /> Dismiss
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-text-primary mb-2">
                    <Provenance claims={provenanceClaims} context="Mitigation suggestion">
                      {m.narrative}
                    </Provenance>
                  </p>
                  <div className="flex items-center gap-4 text-xs text-text-muted font-mono">
                    <span>{m.confidence_pct}% confidence</span>
                    {m.estimated_var_reduction_usd !== null && m.estimated_var_reduction_usd > 0 && (
                      <span className="text-success">
                        ~${(m.estimated_var_reduction_usd / 1_000).toFixed(0)}K potential VaR reduction
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Estimated Impact (VaR) */}
      {exposures.length > 0 && (
        <div className="bg-bg-surface border border-border-subtle rounded-md">
          <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-2">
            <TrendingDown size={14} className="text-severity-high" />
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Estimated Impact</span>
          </div>
          <div className="p-5">
            <div className="text-2xl font-semibold font-mono text-text-primary mb-1">
              ${(totalVarUsd / 1_000_000).toFixed(1)}M at risk
            </div>
            <div className="text-sm text-text-secondary mb-4">
              Across {exposures.length} affected {exposures.length === 1 ? 'entity' : 'entities'} · 95% confidence
            </div>
            <div className="space-y-2">
              {exposures.map((exp) => {
                const entity = entities.find(e => String(e._id) === String(exp.entity_id));
                const pct = entity?.contribution_pct ?? null;
                return (
                  <div key={String(exp._id)} className="flex items-center justify-between py-2 border-t border-border-subtle first:border-0">
                    <span className="text-sm text-text-primary">{entity?.name ?? String(exp.entity_id)}</span>
                    <div className="text-right">
                      <span className="text-sm font-mono font-medium text-text-primary">
                        ${(exp.var_value_usd / 1_000_000).toFixed(1)}M
                      </span>
                      {pct !== null && (
                        <span className="text-xs text-text-muted ml-2">({pct}% of annual revenue)</span>
                      )}
                      {/* M30: coverage line */}
                      {exp.coverage_gap_usd != null && exp.coverage_gap_usd > 0 && (
                        <div className="text-xs font-mono text-severity-high mt-0.5">
                          ${(exp.coverage_gap_usd / 1_000_000).toFixed(1)}M uncovered
                          {(exp.insurance_coverage_pct ?? 0) > 0 && (
                            <span className="text-text-muted ml-1">
                              · {(exp.insurance_coverage_pct ?? 0).toFixed(0)}% insured
                            </span>
                          )}
                        </div>
                      )}
                      {exp.exposure_delta_usd != null && (
                        <div className={`text-xs font-mono mt-0.5 ${exp.exposure_delta_usd > 0 ? 'text-severity-high' : 'text-success'}`}>
                          {exp.exposure_delta_usd > 0 ? '+' : ''}
                          {(exp.exposure_delta_usd / 1_000_000).toFixed(1)}M vs prior
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* Intel Provenance Trail */}
      {provenanceClaims.length > 0 && (
        <div className="bg-bg-surface border border-border-subtle rounded-md">
          <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-2">
            <GitBranch size={14} className="text-accent" />
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
              Intel Provenance Trail
            </span>
            <span className="ml-auto text-xs font-mono text-text-muted">
              {provenanceClaims.length} claim{provenanceClaims.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="p-5">
            <ProvenanceTrail claims={provenanceClaims} />
          </div>
        </div>
      )}
    </div>
  );
}

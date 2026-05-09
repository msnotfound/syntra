import Link from 'next/link';
import { FlaskConical, Plus } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Scenario } from '@syntra/db';
import { TimeAgo } from '@syntra/ui/components/TimeAgo';
import type { IScenario } from '@syntra/db';

interface PageProps { params: { orgSlug: string } }

function formatUsd(val: number | null) {
  if (val === null) return '—';
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000)     return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export default async function ScenariosPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const scenarios = await Scenario.find({ org_id: org._id })
    .sort({ created_at: -1 })
    .limit(50)
    .lean() as unknown as IScenario[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#FAFAFA' }}>Scenario Planner</h1>
          <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
            {scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''} · what-if analysis
          </p>
        </div>
        <Link
          href={`/app/${params.orgSlug}/scenarios/new`}
          className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-all active:scale-95"
          style={{ backgroundColor: '#3B82F6', color: '#FAFAFA', borderRadius: '6px', transitionDuration: '150ms' }}
        >
          <Plus size={14} />
          New Scenario
        </Link>
      </div>

      {scenarios.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-md border"
          style={{ borderColor: '#1E2530', backgroundColor: '#151921' }}
        >
          <FlaskConical size={32} style={{ color: '#475569' }} />
          <p className="mt-3 text-sm font-medium" style={{ color: '#94A3B8' }}>No scenarios yet</p>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>
            Define a hypothetical event and model its supply chain impact.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {scenarios.map(scenario => {
            const eventCount = scenario.hypothesis_events.length;
            const hasResult  = scenario.computed_var_total_usd !== null;
            return (
              <Link
                key={String(scenario._id)}
                href={`/app/${params.orgSlug}/scenarios/${String(scenario._id)}`}
                className="flex items-center justify-between px-4 py-3 rounded-md border transition-colors"
                style={{ backgroundColor: '#151921', borderColor: '#1E2530', transitionDuration: '150ms' }}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: '#FAFAFA' }}>
                    {scenario.name}
                  </div>
                  {scenario.description && (
                    <div className="text-xs mt-0.5 truncate max-w-md" style={{ color: '#64748B' }}>
                      {scenario.description}
                    </div>
                  )}
                  <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                    {eventCount} event{eventCount !== 1 ? 's' : ''} ·{' '}
                    {scenario.affected_entity_ids.length} entities affected
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                  <div className="text-right">
                    <div
                      className="text-sm font-mono font-medium"
                      style={{ color: hasResult ? '#F59E0B' : '#475569' }}
                    >
                      {formatUsd(scenario.computed_var_total_usd)}
                    </div>
                    <div className="text-xs" style={{ color: '#64748B' }}>projected VaR</div>
                  </div>
                  <span
                    className="text-xs px-1.5 py-0.5 font-mono"
                    style={{
                      backgroundColor: hasResult ? 'rgba(245,158,11,0.1)' : '#1E2530',
                      color: hasResult ? '#F59E0B' : '#64748B',
                      borderRadius: '4px',
                    }}
                  >
                    {hasResult ? 'computed' : 'draft'}
                  </span>
                  <TimeAgo date={new Date(scenario.created_at)} className="text-xs font-mono text-text-muted" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

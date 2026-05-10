import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Search, Plus, Clock, CheckCircle2, AlertCircle, Loader2, XCircle } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { ResearchSession } from '@syntra/db';
import type { IResearchSession, ResearchSessionStatus } from '@syntra/db';
import { TimeAgo } from '@syntra/ui/components/TimeAgo';
import { ResearchComposer } from '@/components/research/ResearchComposer';

interface PageProps { params: { orgSlug: string } }

const STATUS_CONFIG: Record<ResearchSessionStatus, { label: string; icon: typeof Clock; className: string }> = {
  planning:    { label: 'Planning',    icon: Loader2,       className: 'text-text-secondary animate-spin' },
  researching: { label: 'Researching', icon: Loader2,       className: 'text-accent animate-spin' },
  drafting:    { label: 'Drafting',    icon: Clock,         className: 'text-yellow-400' },
  finalized:   { label: 'Finalized',   icon: CheckCircle2,  className: 'text-severity-low' },
  cancelled:   { label: 'Cancelled',   icon: XCircle,       className: 'text-text-muted' },
};

export default async function ResearchPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug).catch(() => notFound());

  const sessions = await ResearchSession.find({ org_id: org._id })
    .sort({ created_at: -1 })
    .limit(50)
    .lean() as unknown as IResearchSession[];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Deep Research</h1>
          <p className="text-sm text-text-secondary mt-1">
            Multi-step investigative research that becomes a cited RiskBrief.
          </p>
        </div>
      </div>

      <ResearchComposer orgSlug={params.orgSlug} />

      {sessions.length === 0 ? (
        <div className="bg-bg-surface border border-border-subtle rounded-sm p-12 text-center">
          <Search size={28} className="mx-auto text-text-muted mb-3" />
          <div className="text-sm font-medium text-text-secondary mb-1">No research sessions yet</div>
          <div className="text-xs text-text-muted">
            Enter a question above to start your first deep research session.
          </div>
        </div>
      ) : (
        <div className="bg-bg-surface border border-border-subtle rounded-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border-subtle grid grid-cols-[1fr_100px_80px_120px] gap-4">
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Question</span>
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Status</span>
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Steps</span>
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Created</span>
          </div>
          {sessions.map(s => {
            const config = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.planning;
            const Icon = config.icon;
            const doneSteps = s.plan_steps.filter(p => p.status === 'done').length;
            const totalSteps = s.plan_steps.length;
            return (
              <Link
                key={String(s._id)}
                href={s.status === 'finalized'
                  ? `/app/${params.orgSlug}/research/${String(s._id)}/finalized`
                  : `/app/${params.orgSlug}/research/${String(s._id)}`}
                className="px-5 py-3.5 grid grid-cols-[1fr_100px_80px_120px] gap-4 items-center border-b border-border-subtle last:border-0 hover:bg-bg-surface-2 transition-colors duration-quick"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{s.question}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Icon size={13} className={config.className} />
                  <span className="text-xs text-text-secondary">{config.label}</span>
                </div>
                <div className="text-xs text-text-muted font-mono">
                  {totalSteps > 0 ? `${doneSteps}/${totalSteps}` : '—'}
                </div>
                <div className="text-xs text-text-muted">
                  <TimeAgo date={s.created_at} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

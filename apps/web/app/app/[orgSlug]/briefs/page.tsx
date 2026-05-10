import { notFound } from 'next/navigation';
import Link from 'next/link';
import { FileText, ExternalLink } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { RiskBrief } from '@syntra/db';
import { SeverityBadge } from '@syntra/ui/components/SeverityBadge';
import { TimeAgo } from '@syntra/ui/components/TimeAgo';
import { CopyLinkButton } from '@/components/briefs/CopyLinkButton';
import type { IRiskBrief } from '@syntra/db';
import type { Severity } from '@syntra/shared';
import { headers } from 'next/headers';

interface PageProps { params: { orgSlug: string } }

export default async function BriefsPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const briefs = await RiskBrief.find({ org_id: org._id })
    .sort({ created_at: -1 })
    .limit(100)
    .lean() as unknown as IRiskBrief[];

  const now = new Date();
  const headersList = await headers();
  const host = headersList.get('host') ?? '';
  const proto = headersList.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${host}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Risk Briefs</h1>
        <p className="text-sm text-text-secondary mt-1">
          One-click PDF risk briefs generated from alerts. Share links expire after 30 days.
        </p>
      </div>

      {briefs.length === 0 ? (
        <div className="bg-bg-surface border border-border-subtle rounded-md p-12 text-center">
          <FileText size={32} className="mx-auto text-text-muted mb-4" />
          <div className="text-sm font-medium text-text-secondary mb-1">No briefs yet</div>
          <div className="text-xs text-text-muted">
            Open an alert and click <span className="font-medium text-text-secondary">Generate Brief</span> to create your first PDF risk brief.
          </div>
          <Link
            href={`/app/${params.orgSlug}/alerts`}
            className="inline-flex items-center gap-1.5 mt-4 px-3 h-8 rounded-md text-sm font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-[150ms] ease-out"
          >
            View Alerts
          </Link>
        </div>
      ) : (
        <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
          <div className="px-5 py-3 border-b border-border-subtle grid grid-cols-[1fr_90px_90px_130px_130px] gap-4">
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Brief</span>
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Severity</span>
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Views</span>
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Expires</span>
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Actions</span>
          </div>
          {briefs.map((brief) => {
            const expired = brief.expires_at < now;
            const title = brief.content.alert_title ?? brief.content.entity_name ?? 'Risk Brief';
            const shareUrl = `${origin}/api/v1/briefs/share/${brief.share_token}/view`;
            return (
              <div
                key={String(brief._id)}
                className="px-5 py-3 border-b border-border-subtle last:border-0 grid grid-cols-[1fr_90px_90px_130px_130px] gap-4 items-center hover:bg-bg-surface-2 transition-colors duration-[150ms]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-text-muted flex-shrink-0" />
                    <span className="text-sm font-medium text-text-primary truncate">{title}</span>
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    <TimeAgo date={new Date(brief.created_at)} />
                  </div>
                </div>

                <SeverityBadge severity={brief.content.severity as Severity} />

                <span className="text-sm font-mono text-text-secondary">
                  {brief.view_count} {brief.view_count === 1 ? 'view' : 'views'}
                </span>

                <span className={`text-xs font-mono ${expired ? 'text-severity-high' : 'text-text-muted'}`}>
                  {expired ? 'Expired' : <TimeAgo date={new Date(brief.expires_at)} />}
                </span>

                <div className="flex items-center gap-1.5">
                  {!expired && (
                    <>
                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open PDF"
                        className="flex items-center gap-1 px-2 h-7 rounded-sm text-xs font-medium bg-bg-surface-2 border border-border-default text-text-primary hover:bg-bg-surface-3 transition-colors duration-[150ms] ease-out"
                      >
                        <ExternalLink size={12} />
                        Open
                      </a>
                      <CopyLinkButton shareUrl={shareUrl} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

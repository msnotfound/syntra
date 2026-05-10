import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, FileText } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { ResearchSession, ResearchReport, IntelClaim } from '@syntra/db';
import type { IResearchSession, IResearchReport, IReportSection } from '@syntra/db';
import { Provenance } from '@/components/intel/Provenance';
import { ResearchClaimGraph } from '@/components/research/ResearchClaimGraph';

interface PageProps { params: { orgSlug: string; id: string } }

function SectionView({ section, claimMap }: {
  section: IReportSection;
  claimMap: Record<string, string>;
}) {
  const parts = section.markdown.split(/(\[claim:[^\]]+\])/g);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-text-primary">{section.heading}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">
        {parts.map((part, i) => {
          const match = part.match(/^\[claim:([^\]]+)\]$/);
          if (!match) return <span key={i}>{part}</span>;
          const claimId = match[1]!;
          const claimText = claimMap[claimId] ?? `Claim ${claimId.slice(-6)}`;
          return (
            <Provenance
              key={i}
              claims={[{
                claim_id: claimId,
                claim_text: claimText,
                claim_type: 'fact',
                evidence_url: null,
                asserted_at: new Date().toISOString(),
                source: null,
                parent_claim_ids: [],
                depth: 0,
              }]}
              context={section.heading}
            >
              <mark className="bg-accent/10 text-accent cursor-help rounded-sm px-0.5 hover:bg-accent/20 transition-colors duration-quick">
                [src]
              </mark>
            </Provenance>
          );
        })}
      </p>
    </div>
  );
}

export default async function FinalizedReportPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug).catch(() => notFound());

  const session = await ResearchSession.findOne({
    _id: params.id,
    org_id: org._id,
  }).lean() as unknown as IResearchSession | null;
  if (!session) notFound();

  const report = await ResearchReport.findOne({
    research_session_id: params.id,
    org_id: org._id,
  }).lean() as unknown as IResearchReport | null;
  if (!report) notFound();

  // Build claim text map for citation rendering
  const allClaimIds = [
    ...report.sections.flatMap(s => s.cited_claim_ids),
    ...report.recommended_actions.flatMap(a => a.cited_claim_ids),
  ];
  const uniqueIds = [...new Set(allClaimIds)];
  const claimDocs = await IntelClaim.find({ _id: { $in: uniqueIds } }).select('claim_text').lean();
  const claimMap: Record<string, string> = {};
  for (const c of claimDocs) claimMap[String(c._id)] = c.claim_text;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href={`/app/${params.orgSlug}/research`}
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors duration-quick"
        >
          <ArrowLeft size={12} />
          All research
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">{session.question}</h1>
            <p className="text-xs text-text-muted mt-1 font-mono">
              {report.sections.length} sections · {uniqueIds.length} evidence claims · {report.recommended_actions.length} actions
            </p>
          </div>
          {report.risk_brief_id && (
            <Link
              href={`/app/${params.orgSlug}/briefs`}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-sm text-xs font-medium border border-border-subtle text-text-secondary hover:text-text-primary transition-colors duration-quick"
            >
              <FileText size={12} />
              View in Briefs
            </Link>
          )}
        </div>
      </div>

      {/* Exec summary */}
      <div className="bg-bg-surface border border-border-subtle rounded-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={14} className="text-accent" />
          <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Executive Summary</span>
        </div>
        <p className="text-sm text-text-primary leading-relaxed">{report.exec_summary}</p>
      </div>

      {/* Sections */}
      {report.sections.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary">Research Sections</h2>
          <div className="bg-bg-surface border border-border-subtle rounded-sm divide-y divide-border-subtle">
            {report.sections.map((section, i) => (
              <div key={i} className="p-5">
                <SectionView section={section} claimMap={claimMap} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended actions */}
      {report.recommended_actions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary">Recommended Actions</h2>
          <div className="space-y-2">
            {report.recommended_actions.map((action, i) => (
              <div key={i} className="bg-bg-surface border border-border-subtle rounded-sm p-4 space-y-1.5">
                <p className="text-sm font-medium text-text-primary">{i + 1}. {action.text}</p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {action.cited_claim_ids.length > 0 ? (
                    <Provenance
                      claims={action.cited_claim_ids.map(id => ({
                        claim_id: id,
                        claim_text: claimMap[id] ?? `Claim ${id.slice(-6)}`,
                        claim_type: 'inference' as const,
                        evidence_url: null,
                        asserted_at: new Date().toISOString(),
                        source: null,
                        parent_claim_ids: [],
                        depth: 0,
                      }))}
                      context={action.text}
                    >
                      {action.rationale}
                    </Provenance>
                  ) : action.rationale}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claim graph */}
      {report.claim_graph.nodes.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary">Evidence Graph</h2>
          <div className="bg-bg-surface border border-border-subtle rounded-sm overflow-hidden h-96">
            <ResearchClaimGraph
              nodes={report.claim_graph.nodes}
              edges={report.claim_graph.edges}
            />
          </div>
        </div>
      )}
    </div>
  );
}

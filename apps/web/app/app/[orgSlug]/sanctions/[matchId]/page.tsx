import { notFound } from 'next/navigation';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { SanctionsReviewQueue, WatchlistEntity } from '@syntra/db';
import type { ISanctionsReviewQueue, IWatchlistEntity } from '@syntra/db';
import { compositeSanctionsMatch } from '@syntra/shared/utils/sanctions-match';
import { colors, radii, spacing, typography } from '@syntra/ui/tokens';

interface PageProps {
  params: { orgSlug: string; matchId: string };
}

function formatDate(value: Date | string): string {
  return new Date(value).toISOString().replace('T', ' ').slice(0, 16);
}

function ContributorRow({
  label,
  score,
  weight,
  weightedScore,
  detail,
}: {
  label: string;
  score: number;
  weight: number;
  weightedScore: number;
  detail: string;
}) {
  return (
    <div
      className="grid grid-cols-1 items-start gap-2 border-b last:border-b-0 lg:grid-cols-4 lg:items-center lg:gap-4"
      style={{
        borderColor: colors.border.subtle,
        padding: `${spacing.px[4]} 0`,
      }}
    >
      <div style={{ color: colors.text.primary, fontSize: typography.sizes.sm, fontWeight: typography.weights.medium }}>
        {label}
      </div>
      <div style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }}>
        {detail}
      </div>
      <div style={{ color: colors.text.primary, fontFamily: typography.fonts.mono, fontSize: typography.sizes.sm }}>
        {score}/100
      </div>
      <div style={{ color: colors.text.muted, fontFamily: typography.fonts.mono, fontSize: typography.sizes.sm }}>
        x{weight.toFixed(2)} = {weightedScore}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const border = status === 'confirmed'
    ? colors.severity.critical
    : status === 'cleared'
      ? colors.severity.low
      : colors.severity.medium;

  return (
    <span
      className="inline-flex h-6 items-center border px-2 font-medium"
      style={{
        borderColor: border,
        borderRadius: radii.sm,
        color: border,
        backgroundColor: `${border}1f`,
        fontSize: typography.sizes.xs,
      }}
    >
      {status}
    </span>
  );
}

export default async function SanctionsMatchDetailPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const match = await SanctionsReviewQueue.findOne({
    _id: params.matchId,
    org_id: org._id,
  }).lean() as unknown as ISanctionsReviewQueue | null;

  if (!match) notFound();

  const entity = await WatchlistEntity.findOne({
    _id: match.entity_id,
    org_id: org._id,
  }).lean() as unknown as IWatchlistEntity | null;

  if (!entity) notFound();

  const composite = compositeSanctionsMatch(entity, match.entry);
  const contributors = [
    ['Name', composite.contributors.name],
    ['DOB', composite.contributors.dob],
    ['Country', composite.contributors.country],
    ['Address', composite.contributors.address],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <a
            href={`/app/${params.orgSlug}/sanctions?status=${match.status}`}
            className="text-sm transition-colors hover:text-accent-hover"
            style={{ color: colors.accent.DEFAULT }}
          >
            Sanctions screening
          </a>
          <h1 className="mt-2 text-xl font-semibold text-text-primary">
            Match audit: {match.entity_name}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Contributor-level scoring for the sanctions match decision.
          </p>
        </div>
        <div className="text-right">
          <StatusPill status={match.status} />
          <div className="mt-2 font-mono text-2xl text-text-primary">{composite.score}</div>
          <div className="text-xs text-text-muted">composite score</div>
        </div>
      </div>

      <section
        className="border"
        style={{
          backgroundColor: colors.bg.surface,
          borderColor: colors.border.subtle,
          borderRadius: radii.md,
          padding: spacing.px[5],
        }}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Entity</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted">Name</dt>
                <dd className="text-right text-text-primary">{entity.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted">Country</dt>
                <dd className="font-mono text-text-secondary">{entity.country_code ?? 'missing'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted">DOB</dt>
                <dd className="font-mono text-text-secondary">{String(entity.metadata?.dob ?? 'missing')}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted">Address</dt>
                <dd className="text-right text-text-secondary">
                  {String(entity.metadata?.address ?? 'missing')}
                </dd>
              </div>
            </dl>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Sanctions Entry</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted">Name</dt>
                <dd className="text-right text-text-primary">{match.entry.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted">Matched Alias</dt>
                <dd className="text-right text-text-secondary">{match.matched_name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted">List</dt>
                <dd className="font-mono text-text-secondary">{match.list_name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted">Programs</dt>
                <dd className="text-right text-text-secondary">{match.entry.programs.join(', ') || 'none'}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section
        className="border"
        style={{
          backgroundColor: colors.bg.surface,
          borderColor: colors.border.subtle,
          borderRadius: radii.md,
          padding: `0 ${spacing.px[5]}`,
        }}
      >
        {contributors.map(([label, contributor]) => (
          <ContributorRow key={label} label={label} {...contributor} />
        ))}
      </section>

      <section
        className="border"
        style={{
          backgroundColor: colors.bg.surface,
          borderColor: colors.border.subtle,
          borderRadius: radii.md,
          padding: spacing.px[5],
        }}
      >
        <h2 className="text-sm font-semibold text-text-primary">Audit Trail</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 text-sm lg:grid-cols-2">
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Decision</dt>
            <dd className="font-mono text-text-secondary">{composite.decision}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Stored score</dt>
            <dd className="font-mono text-text-secondary">{match.match_score}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">List version</dt>
            <dd className="font-mono text-text-secondary">{match.list_version}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Screened at</dt>
            <dd className="font-mono text-text-secondary">{formatDate(match.screened_at)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Entity variant</dt>
            <dd className="text-right text-text-secondary">{composite.matchedEntityName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Sanctions variant</dt>
            <dd className="text-right text-text-secondary">{composite.matchedSanctionsName}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

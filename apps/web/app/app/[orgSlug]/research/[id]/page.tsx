import { notFound } from 'next/navigation';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { ResearchSession } from '@syntra/db';
import type { IResearchSession } from '@syntra/db';
import { ResearchSessionView } from '@/components/research/ResearchSessionView';

interface PageProps { params: { orgSlug: string; id: string } }

export default async function ResearchSessionPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug).catch(() => notFound());

  const session = await ResearchSession.findOne({
    _id: params.id,
    org_id: org._id,
  }).lean() as unknown as IResearchSession | null;

  if (!session) notFound();

  if (session.status === 'finalized') {
    const { redirect } = await import('next/navigation');
    redirect(`/app/${params.orgSlug}/research/${params.id}/finalized`);
  }

  return (
    <ResearchSessionView
      initialSession={JSON.parse(JSON.stringify(session))}
      orgSlug={params.orgSlug}
    />
  );
}

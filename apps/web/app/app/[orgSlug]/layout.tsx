import { notFound } from 'next/navigation';
import { Sidebar } from '@/components/shell/Sidebar';
import { TopBar } from '@/components/shell/TopBar';
import { AssistantDrawer } from '@/components/assistant/AssistantDrawer';
import { getOrgBySlug } from '@/lib/org';
import { ensureDb } from '@/lib/db';

interface OrgLayoutProps {
  children: React.ReactNode;
  params: { orgSlug: string };
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  await ensureDb();
  const org = await getOrgBySlug(params.orgSlug);
  if (!org) notFound();

  return (
    <div className="flex flex-col h-screen bg-bg-base">
      <TopBar orgName={org.name} orgSlug={org.slug} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar orgSlug={org.slug} orgName={org.name} />
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-8 py-6">
            {children}
          </div>
        </main>
      </div>
      <AssistantDrawer orgSlug={org.slug} />
    </div>
  );
}

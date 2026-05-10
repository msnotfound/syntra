import Link from 'next/link';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { SlackInstall, TeamsInstall } from '@syntra/db';

interface PageProps { params: { orgSlug: string } }

const SUB_NAV = [
  { label: 'General',      href: '' },
  { label: 'Alerts',       href: '/alerts' },
  { label: 'Integrations', href: '/integrations' },
  { label: 'Team',         href: '/team' },
  { label: 'API',          href: '/api-keys' },
  { label: 'Billing',      href: '/billing' },
];

export default async function IntegrationsPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const [slackInstall, teamsInstall] = await Promise.all([
    SlackInstall.findOne({ org_id: org._id }).lean(),
    TeamsInstall.findOne({ org_id: org._id }).lean(),
  ]);

  const integrations = [
    {
      id: 'slack',
      name: 'Slack',
      description: 'Post interactive alert cards to a Slack workspace. Acknowledge and assign alerts without leaving Slack.',
      logo: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.521 2.528 2.528 0 0 1-2.521-2.52 2.528 2.528 0 0 1 2.52-2.521h2.521v2.52zM6.313 15.165a2.528 2.528 0 0 1 2.521-2.521 2.528 2.528 0 0 1 2.521 2.52v6.313a2.528 2.528 0 0 1-2.52 2.522 2.528 2.528 0 0 1-2.522-2.521v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.521v2.521H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.52 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.521-2.521h6.313zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.524 2.521 2.528 2.528 0 0 1-2.521-2.52V2.522A2.528 2.528 0 0 1 15.163 0a2.528 2.528 0 0 1 2.525 2.521v6.313zM15.163 18.956a2.528 2.528 0 0 1 2.525 2.522A2.528 2.528 0 0 1 15.163 24a2.528 2.528 0 0 1-2.521-2.522v-2.522h2.521zM15.163 17.688a2.528 2.528 0 0 1-2.521-2.524 2.528 2.528 0 0 1 2.52-2.521h6.313A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.525h-6.315z" fill="#E01E5A"/>
        </svg>
      ),
      connected: !!slackInstall,
      detail: slackInstall ? `${slackInstall.team_name} · installed ${new Date(slackInstall.installed_at).toLocaleDateString()}` : null,
      installHref: `/api/integrations/slack/install?org=${params.orgSlug}`,
    },
    {
      id: 'teams',
      name: 'Microsoft Teams',
      description: 'Deliver Adaptive Card alerts to a Teams channel. Take action directly inside Teams.',
      logo: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20.625 6.75h-5.25v9a3.375 3.375 0 0 0 3.375 3.375h.75A3.375 3.375 0 0 0 22.875 15.75V9a2.25 2.25 0 0 0-2.25-2.25z" fill="#5059C9"/>
          <circle cx="19.5" cy="4.5" r="2.25" fill="#5059C9"/>
          <path d="M13.5 6.75A6.75 6.75 0 1 1 0 6.75a6.75 6.75 0 0 1 13.5 0" fill="#7B83EB"/>
          <path d="M6.75 6.75v10.5M9 6.75H4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
      connected: !!teamsInstall,
      detail: teamsInstall ? `tenant: ${teamsInstall.tenant_id || 'configured'} · installed ${new Date(teamsInstall.installed_at).toLocaleDateString()}` : null,
      installHref: `/api/integrations/teams/install?org=${params.orgSlug}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
      </div>

      <div className="flex gap-8">
        {/* Sub-nav */}
        <nav className="w-40 flex-shrink-0 space-y-0.5">
          {SUB_NAV.map(item => (
            <Link
              key={item.href}
              href={`/app/${params.orgSlug}/settings${item.href}`}
              className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors duration-[150ms] ease-out border-l-2 ${
                item.href === '/integrations'
                  ? 'border-accent bg-bg-surface-2 text-text-primary'
                  : 'border-transparent text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 max-w-2xl space-y-4">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1">Integrations</h2>
            <p className="text-xs text-text-muted">Connect Syntra to your team&apos;s communication tools.</p>
          </div>

          {integrations.map(intg => (
            <div key={intg.id} className="bg-bg-surface border border-border-subtle rounded-md p-5 flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-md bg-bg-surface-2 border border-border-default flex items-center justify-center">
                {intg.logo}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-text-primary">{intg.name}</span>
                  {intg.connected && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-severity-low/10 text-severity-low border border-severity-low/20">
                      <span className="w-1 h-1 rounded-full bg-severity-low" />
                      Connected
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted leading-relaxed mb-2">{intg.description}</p>
                {intg.detail && (
                  <p className="text-xs font-mono text-text-secondary">{intg.detail}</p>
                )}
              </div>

              <div className="flex-shrink-0">
                {intg.connected ? (
                  <a
                    href={intg.installHref}
                    className="px-3 h-7 rounded-md text-xs font-medium border border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors duration-[150ms] ease-out inline-flex items-center"
                  >
                    Reconnect
                  </a>
                ) : (
                  <a
                    href={intg.installHref}
                    className="px-3 h-7 rounded-md text-xs font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95 inline-flex items-center"
                  >
                    Connect
                  </a>
                )}
              </div>
            </div>
          ))}

          <p className="text-xs text-text-muted pt-2">
            More integrations (PagerDuty, Jira, email digests) coming in a future update.
          </p>
        </div>
      </div>
    </div>
  );
}

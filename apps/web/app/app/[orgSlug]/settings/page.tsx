import Link from 'next/link';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';

interface PageProps { params: { orgSlug: string } }

export default async function SettingsPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const SUB_NAV = [
    { label: 'General', href: '' },
    { label: 'Alerts', href: '/alerts', active: true },
    { label: 'Team', href: '/team' },
    { label: 'API', href: '/api-keys' },
    { label: 'Billing', href: '/billing' },
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
                item.active
                  ? 'border-accent bg-bg-surface-2 text-text-primary'
                  : 'border-transparent text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 max-w-2xl">
          <div className="bg-bg-surface border border-border-subtle rounded-md">
            {/* Alert Channels */}
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1">Alert Channels</h2>
              <p className="text-xs text-text-muted mb-5">Choose how you want to receive alerts.</p>
              <div className="space-y-4">
                {[
                  { id: 'email', label: 'Email', enabled: org.settings.alert_channels.includes('email'), detail: org.contact_email },
                  { id: 'whatsapp', label: 'WhatsApp', enabled: org.settings.alert_channels.includes('whatsapp'), detail: org.contact_phone ?? 'Not configured' },
                  { id: 'webhook', label: 'Webhook', enabled: org.settings.alert_channels.includes('webhook'), detail: org.settings.webhook_url ?? 'Not configured' },
                ].map(ch => (
                  <div key={ch.id} className="flex items-center gap-4">
                    <div className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors duration-[150ms] ease-out ${ch.enabled ? 'bg-accent' : 'bg-bg-surface-3'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-colors duration-[150ms] ease-out ${ch.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-text-primary">{ch.label}</div>
                      <div className="text-xs text-text-muted font-mono">{ch.detail}</div>
                    </div>
                    <button className="px-2 h-6 rounded text-xs text-text-secondary border border-border-default hover:border-border-strong hover:text-text-primary transition-colors duration-[150ms]">
                      Change
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Severity threshold */}
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1">Severity Threshold</h2>
              <p className="text-xs text-text-muted mb-4">Only send alerts at or above this severity.</p>
              <div className="flex items-center gap-2">
                {(['critical','high','medium','low'] as const).map(s => {
                  const color = { critical: '#EF4444', high: '#F97316', medium: '#EAB308', low: '#60A5FA' }[s];
                  const active = org.settings.severity_threshold === s;
                  return (
                    <button
                      key={s}
                      className={`flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium border transition-colors duration-[150ms] ease-out active:scale-95 ${
                        active ? 'border-border-strong bg-bg-surface-3 text-text-primary' : 'border-border-default bg-bg-surface-2 text-text-secondary'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                      {active && ' ✓'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quiet hours */}
            <div className="p-6">
              <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1">Quiet Hours</h2>
              <p className="text-xs text-text-muted mb-4">Alerts will be queued and delivered after quiet hours end.</p>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors duration-[150ms] ease-out ${org.settings.quiet_hours_start ? 'bg-accent' : 'bg-bg-surface-3'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-colors duration-[150ms] ${org.settings.quiet_hours_start ? 'left-[18px]' : 'left-0.5'}`} />
                </div>
                <span className="text-sm text-text-primary">Enable quiet hours</span>
              </div>
              {org.settings.quiet_hours_start && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-text-secondary">From</span>
                  <div className="px-3 h-8 rounded-md bg-bg-surface-2 border border-border-default text-sm font-mono text-text-primary flex items-center">
                    {org.settings.quiet_hours_start}
                  </div>
                  <span className="text-sm text-text-secondary">to</span>
                  <div className="px-3 h-8 rounded-md bg-bg-surface-2 border border-border-default text-sm font-mono text-text-primary flex items-center">
                    {org.settings.quiet_hours_end}
                  </div>
                  <span className="text-sm text-text-secondary">in</span>
                  <div className="px-3 h-8 rounded-md bg-bg-surface-2 border border-border-default text-sm text-text-primary flex items-center">
                    {org.settings.timezone}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border-subtle flex justify-end">
              <button className="px-3 h-8 rounded-md text-sm font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95">
                Save changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

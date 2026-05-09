'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

interface DigestPrefs {
  frequency: 'daily' | 'weekly' | 'monthly';
  channels: string[];
  sections: string[];
  enabled: boolean;
}

const SUB_NAV = [
  { label: 'General',  href: '' },
  { label: 'Alerts',   href: '/alerts' },
  { label: 'Digests',  href: '/digests' },
  { label: 'Team',     href: '/team' },
  { label: 'API',      href: '/api-keys' },
  { label: 'Billing',  href: '/billing' },
];

const SECTIONS = [
  { id: 'alerts',           label: 'Alert list',        desc: 'New alerts since last digest' },
  { id: 'severity_heatmap', label: 'Severity heatmap',  desc: 'Delta in severity distribution' },
  { id: 'watchlist_health', label: 'Watchlist health',  desc: 'Entities in hot zones vs. quiet' },
  { id: 'var_summary',      label: 'VaR summary',       desc: 'Top entities by financial exposure' },
];

export default function DigestsSettingsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [prefs, setPrefs] = useState<DigestPrefs>({
    frequency: 'daily',
    channels: ['email'],
    sections: ['alerts', 'severity_heatmap', 'watchlist_health'],
    enabled: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/digests/preferences')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setPrefs(d.data); })
      .catch(() => {});
  }, []);

  function toggleSection(id: string) {
    setPrefs(p => ({
      ...p,
      sections: p.sections.includes(id)
        ? p.sections.filter(s => s !== id)
        : [...p.sections, id],
    }));
  }

  function toggleChannel(id: string) {
    setPrefs(p => ({
      ...p,
      channels: p.channels.includes(id)
        ? p.channels.filter(c => c !== id)
        : [...p.channels, id],
    }));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch('/api/v1/digests/preferences', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(prefs),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handlePreview() {
    setPreviewing(true);
    setPreviewMsg(null);
    try {
      const res = await fetch(`/api/v1/digests/preview?org=${orgSlug}`, { method: 'POST' });
      setPreviewMsg(res.ok ? 'Preview email sent to your inbox.' : 'Failed to send preview.');
    } catch {
      setPreviewMsg('Failed to send preview.');
    }
    setPreviewing(false);
    setTimeout(() => setPreviewMsg(null), 5000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
      </div>

      <div className="flex gap-8">
        <nav className="w-40 flex-shrink-0 space-y-0.5">
          {SUB_NAV.map(item => (
            <Link
              key={item.href}
              href={`/app/${orgSlug}/settings${item.href}`}
              className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors duration-[150ms] ease-out border-l-2 ${
                item.href === '/digests'
                  ? 'border-accent bg-bg-surface-2 text-text-primary'
                  : 'border-transparent text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1 max-w-2xl space-y-4">
          <div className="bg-bg-surface border border-border-subtle rounded-md">

            {/* Enable toggle */}
            <div className="p-6 border-b border-border-subtle">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPrefs(p => ({ ...p, enabled: !p.enabled }))}
                  className={`w-9 h-5 rounded-full relative transition-colors duration-[150ms] ease-out ${prefs.enabled ? 'bg-accent' : 'bg-bg-surface-3'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-[150ms] ease-out ${prefs.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
                <div>
                  <div className="text-sm font-medium text-text-primary">Enable risk digests</div>
                  <div className="text-xs text-text-muted">Receive periodic summaries of your risk landscape.</div>
                </div>
              </div>
            </div>

            {/* Frequency */}
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1">Frequency</h2>
              <p className="text-xs text-text-muted mb-4">How often you want to receive digests.</p>
              <div className="flex items-center gap-2">
                {(['daily', 'weekly', 'monthly'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setPrefs(p => ({ ...p, frequency: f }))}
                    className={`px-3 h-7 rounded-md text-xs font-medium border transition-colors duration-[150ms] ease-out active:scale-95 ${
                      prefs.frequency === f
                        ? 'border-accent bg-bg-surface-3 text-text-primary'
                        : 'border-border-default bg-bg-surface-2 text-text-secondary hover:border-border-strong hover:text-text-primary'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-text-muted mt-3">
                {prefs.frequency === 'daily' && 'Delivered weekdays at 08:00 IST.'}
                {prefs.frequency === 'weekly' && 'Delivered every Monday at 08:00 IST.'}
                {prefs.frequency === 'monthly' && 'Delivered on the 1st of each month at 08:00 IST.'}
              </p>
            </div>

            {/* Channels */}
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1">Delivery Channels</h2>
              <p className="text-xs text-text-muted mb-4">Where to deliver your digests.</p>
              <div className="space-y-3">
                {[
                  { id: 'email',    label: 'Email' },
                  { id: 'whatsapp', label: 'WhatsApp' },
                  { id: 'webhook',  label: 'Webhook' },
                ].map(ch => {
                  const on = prefs.channels.includes(ch.id);
                  return (
                    <div key={ch.id} className="flex items-center gap-3">
                      <button
                        onClick={() => toggleChannel(ch.id)}
                        className={`w-9 h-5 rounded-full relative transition-colors duration-[150ms] ease-out ${on ? 'bg-accent' : 'bg-bg-surface-3'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-[150ms] ease-out ${on ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                      <span className="text-sm text-text-primary">{ch.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sections */}
            <div className="p-6">
              <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1">Digest Sections</h2>
              <p className="text-xs text-text-muted mb-4">Choose what appears in your digest.</p>
              <div className="space-y-3">
                {SECTIONS.map(sec => {
                  const on = prefs.sections.includes(sec.id);
                  return (
                    <div key={sec.id} className="flex items-start gap-3">
                      <button
                        onClick={() => toggleSection(sec.id)}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors duration-[150ms] ease-out flex-shrink-0 ${on ? 'bg-accent border-accent' : 'bg-bg-surface-3 border-border-default'}`}
                      >
                        {on && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </button>
                      <div>
                        <div className="text-sm text-text-primary">{sec.label}</div>
                        <div className="text-xs text-text-muted">{sec.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-3">
                {saved && (
                  <span className="flex items-center gap-1.5 text-sm text-green-400">
                    <CheckCircle2 size={14} />
                    Saved
                  </span>
                )}
                {previewMsg && (
                  <span className="text-sm text-text-secondary">{previewMsg}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePreview}
                  disabled={previewing || !prefs.enabled}
                  className="px-3 h-8 rounded-md text-sm font-medium border border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-40"
                >
                  {previewing ? 'Sending…' : 'Send preview'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 h-8 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

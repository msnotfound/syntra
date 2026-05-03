'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
const SEV_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F97316', medium: '#EAB308', low: '#60A5FA', info: '#94A3B8' };

interface Settings {
  alert_channels: string[];
  severity_threshold: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
  webhook_url: string | null;
}

const SUB_NAV = [
  { label: 'General', href: '' },
  { label: 'Alerts',  href: '/alerts' },
  { label: 'Team',    href: '/team' },
  { label: 'API',     href: '/api-keys' },
  { label: 'Billing', href: '/billing' },
];

export default function AlertSettingsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [settings, setSettings] = useState<Settings>({
    alert_channels: ['email'],
    severity_threshold: 'high',
    quiet_hours_start: null,
    quiet_hours_end: null,
    timezone: 'Asia/Kolkata',
    webhook_url: null,
  });
  const [webhookUrl, setWebhookUrl] = useState('');
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');

  useEffect(() => {
    fetch(`/api/v1/orgs/${orgSlug}/settings`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.data) return;
        const s = d.data as Settings;
        setSettings(s);
        setWebhookUrl(s.webhook_url ?? '');
        setQuietEnabled(!!(s.quiet_hours_start));
      })
      .catch(() => {});
  }, [orgSlug]);

  function toggleChannel(c: string) {
    setSettings(s => ({
      ...s,
      alert_channels: s.alert_channels.includes(c)
        ? s.alert_channels.filter(x => x !== c)
        : [...s.alert_channels, c],
    }));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const body: Partial<Settings> = {
      ...settings,
      webhook_url: webhookUrl || null,
      quiet_hours_start: quietEnabled ? settings.quiet_hours_start : null,
      quiet_hours_end: quietEnabled ? settings.quiet_hours_end : null,
    };
    await fetch(`/api/v1/orgs/${orgSlug}/settings`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function testWebhook() {
    if (!webhookUrl) return;
    setTestStatus('sending');
    try {
      const res = await fetch('/api/v1/webhooks/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      });
      setTestStatus(res.ok ? 'ok' : 'error');
    } catch {
      setTestStatus('error');
    }
    setTimeout(() => setTestStatus('idle'), 4000);
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
                item.href === '/alerts'
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
            {/* Alert channels */}
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1">Alert Channels</h2>
              <p className="text-xs text-text-muted mb-5">Toggle how you receive alerts.</p>
              <div className="space-y-3">
                {[
                  { id: 'email',    label: 'Email' },
                  { id: 'whatsapp', label: 'WhatsApp' },
                  { id: 'webhook',  label: 'Webhook' },
                ].map(ch => {
                  const on = settings.alert_channels.includes(ch.id);
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

            {/* Severity threshold */}
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1">Severity Threshold</h2>
              <p className="text-xs text-text-muted mb-4">Only send alerts at or above this level.</p>
              <div className="flex items-center gap-2">
                {SEVERITIES.map(s => {
                  const active = settings.severity_threshold === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setSettings(prev => ({ ...prev, severity_threshold: s }))}
                      className={`flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium border transition-colors duration-[150ms] ease-out active:scale-95 ${
                        active ? 'border-border-strong bg-bg-surface-3 text-text-primary' : 'border-border-default bg-bg-surface-2 text-text-secondary hover:border-border-muted'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SEV_COLOR[s] }} />
                      <span className="capitalize">{s}</span>
                      {active && <span className="text-accent">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quiet hours */}
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1">Quiet Hours</h2>
              <p className="text-xs text-text-muted mb-4">Queue alerts during these hours and deliver after.</p>
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => setQuietEnabled(v => !v)}
                  className={`w-9 h-5 rounded-full relative transition-colors duration-[150ms] ease-out ${quietEnabled ? 'bg-accent' : 'bg-bg-surface-3'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-[150ms] ${quietEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
                <span className="text-sm text-text-primary">Enable quiet hours</span>
              </div>
              {quietEnabled && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-text-secondary">From</span>
                  <input
                    type="time"
                    value={settings.quiet_hours_start ?? '22:00'}
                    onChange={e => setSettings(s => ({ ...s, quiet_hours_start: e.target.value }))}
                    className="h-8 px-3 rounded-md bg-bg-surface-2 border border-border-default text-sm font-mono text-text-primary focus:outline-none focus:border-accent"
                  />
                  <span className="text-sm text-text-secondary">to</span>
                  <input
                    type="time"
                    value={settings.quiet_hours_end ?? '07:00'}
                    onChange={e => setSettings(s => ({ ...s, quiet_hours_end: e.target.value }))}
                    className="h-8 px-3 rounded-md bg-bg-surface-2 border border-border-default text-sm font-mono text-text-primary focus:outline-none focus:border-accent"
                  />
                  <span className="text-sm text-text-secondary">timezone:</span>
                  <select
                    value={settings.timezone}
                    onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}
                    className="h-8 px-2 rounded-md bg-bg-surface-2 border border-border-default text-sm text-text-primary focus:outline-none focus:border-accent"
                  >
                    {['Asia/Kolkata', 'UTC', 'Asia/Dubai', 'Europe/London', 'America/New_York'].map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Webhook URL */}
            <div className="p-6">
              <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1">Webhook URL</h2>
              <p className="text-xs text-text-muted mb-4">Syntra will POST alert payloads to this URL.</p>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://your-server.com/syntra-hook"
                  className="flex-1 h-9 px-3 rounded-md bg-bg-surface-2 border border-border-default text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent transition-colors duration-[150ms] ease-out font-mono"
                />
                <button
                  onClick={testWebhook}
                  disabled={!webhookUrl || testStatus === 'sending'}
                  className="flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-medium border border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-40"
                >
                  {testStatus === 'sending' ? (
                    <span className="text-xs">Sending…</span>
                  ) : testStatus === 'ok' ? (
                    <><CheckCircle2 size={14} className="text-green-400" /><span className="text-xs text-green-400">OK</span></>
                  ) : testStatus === 'error' ? (
                    <><AlertCircle size={14} className="text-red-400" /><span className="text-xs text-red-400">Failed</span></>
                  ) : (
                    <><Send size={14} /><span className="text-xs">Test</span></>
                  )}
                </button>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border-subtle flex items-center justify-between">
              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-green-400">
                  <CheckCircle2 size={14} />
                  Saved
                </span>
              )}
              <div className="ml-auto">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 h-8 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

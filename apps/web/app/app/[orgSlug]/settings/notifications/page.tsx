'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Plus, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

type ChannelType = 'email' | 'slack' | 'teams' | 'webhook' | 'sms';
type Format = 'summary' | 'full' | 'oneliner';
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface NotificationChannel {
  _id: string;
  channel_type: ChannelType;
  destination: string;
  verified: boolean;
}

interface ChannelConfig {
  channel_id: ChannelType;
  destination_id: string;
  format: Format;
  enabled: boolean;
}

interface DeliveryWindow {
  start_hour: number;
  end_hour: number;
  timezone: string;
}

interface Prefs {
  channel_configs: ChannelConfig[];
  delivery_window: DeliveryWindow;
  priority_threshold: Severity;
}

const SEV_COLOR: Record<Severity, string> = {
  critical: '#EF4444',
  high:     '#F97316',
  medium:   '#EAB308',
  low:      '#60A5FA',
  info:     '#94A3B8',
};

const CHANNEL_LABELS: Record<ChannelType, string> = {
  email:   'Email',
  slack:   'Slack',
  teams:   'Teams',
  webhook: 'Webhook',
  sms:     'SMS',
};

const FORMAT_LABELS: Record<Format, string> = {
  oneliner: 'One-liner',
  summary:  'Summary',
  full:     'Full card',
};

const SUB_NAV = [
  { label: 'General',       href: '' },
  { label: 'Alerts',        href: '/alerts' },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Digests',       href: '/digests' },
  { label: 'Team',          href: '/team' },
  { label: 'API',           href: '/api-keys' },
  { label: 'Billing',       href: '/billing' },
];

const TIMEZONES = [
  'Asia/Kolkata', 'UTC', 'Asia/Dubai', 'Asia/Singapore',
  'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles',
];

export default function NotificationsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();

  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({
    channel_configs: [],
    delivery_window: { start_hour: 8, end_hour: 22, timezone: 'Asia/Kolkata' },
    priority_threshold: 'high',
  });

  const [addType, setAddType] = useState<ChannelType>('email');
  const [addDest, setAddDest] = useState('');
  const [addFormat, setAddFormat] = useState<Format>('summary');
  const [addStatus, setAddStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');

  // Verify flow
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/v1/notifications/channels?orgSlug=${orgSlug}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/v1/digests/preferences?orgSlug=${orgSlug}`).then(r => r.ok ? r.json() : null),
    ]).then(([ch, pref]) => {
      if (ch?.data) setChannels(ch.data);
      if (pref?.data) {
        setPrefs(p => ({
          ...p,
          channel_configs:    pref.data.channel_configs    ?? p.channel_configs,
          delivery_window:    pref.data.delivery_window    ?? p.delivery_window,
          priority_threshold: pref.data.priority_threshold ?? p.priority_threshold,
        }));
      }
    }).catch(() => {});
  }, [orgSlug]);

  async function handleAddChannel() {
    if (!addDest.trim()) return;
    setAddStatus('sending');
    try {
      const res = await fetch('/api/v1/notifications/channels', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgSlug, channel_type: addType, destination: addDest.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setChannels(prev => [...prev, data.data]);
      // Auto-add to channel_configs
      setPrefs(p => ({
        ...p,
        channel_configs: [...p.channel_configs, {
          channel_id: addType,
          destination_id: addDest.trim(),
          format: addFormat,
          enabled: true,
        }],
      }));
      setAddDest('');
      setAddStatus('ok');
      // Trigger OTP verification for email/sms
      if (addType === 'email' || addType === 'sms') {
        setVerifyId(data.data._id);
      }
    } catch {
      setAddStatus('error');
    }
    setTimeout(() => setAddStatus('idle'), 3000);
  }

  async function handleVerifyOtp() {
    if (!verifyId || !otpInput.trim()) return;
    setVerifyStatus('sending');
    try {
      const res = await fetch(`/api/v1/notifications/channels/${verifyId}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: otpInput.trim() }),
      });
      if (!res.ok) throw new Error();
      setChannels(prev => prev.map(c => c._id === verifyId ? { ...c, verified: true } : c));
      setVerifyStatus('ok');
      setVerifyId(null);
      setOtpInput('');
    } catch {
      setVerifyStatus('error');
    }
    setTimeout(() => setVerifyStatus('idle'), 3000);
  }

  async function handleDeleteChannel(id: string) {
    await fetch(`/api/v1/notifications/channels/${id}`, { method: 'DELETE' });
    setChannels(prev => prev.filter(c => c._id !== id));
  }

  function toggleConfig(idx: number) {
    setPrefs(p => {
      const configs = [...p.channel_configs];
      configs[idx] = { ...configs[idx], enabled: !configs[idx].enabled };
      return { ...p, channel_configs: configs };
    });
  }

  function setConfigFormat(idx: number, format: Format) {
    setPrefs(p => {
      const configs = [...p.channel_configs];
      configs[idx] = { ...configs[idx], format };
      return { ...p, channel_configs: configs };
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch(`/api/v1/digests/preferences`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orgSlug,
        channel_configs:    prefs.channel_configs,
        delivery_window:    prefs.delivery_window,
        priority_threshold: prefs.priority_threshold,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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
                item.href === '/notifications'
                  ? 'border-accent bg-bg-surface-2 text-text-primary'
                  : 'border-transparent text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1 max-w-2xl space-y-4">
          {/* Registered Channels */}
          <div className="bg-bg-surface border border-border-subtle rounded-md">
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1">Registered Channels</h2>
              <p className="text-xs text-text-muted mb-5">Add channels where you want to receive alerts.</p>

              {channels.length === 0 && (
                <p className="text-sm text-text-muted italic">No channels registered yet.</p>
              )}
              {channels.map(ch => (
                <div key={ch._id} className="flex items-center gap-3 py-2 border-b border-border-subtle last:border-0">
                  <span className="w-20 text-xs font-medium text-text-secondary capitalize">{CHANNEL_LABELS[ch.channel_type]}</span>
                  <span className="flex-1 text-sm text-text-primary font-mono truncate">{ch.destination}</span>
                  {ch.verified ? (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <CheckCircle2 size={12} />Verified
                    </span>
                  ) : (
                    <button
                      onClick={() => setVerifyId(ch._id)}
                      className="text-xs text-accent hover:text-accent-hover transition-colors duration-[150ms] ease-out"
                    >
                      Verify
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteChannel(ch._id)}
                    className="text-text-muted hover:text-red-400 transition-colors duration-[150ms] ease-out active:scale-95"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add channel form */}
            <div className="p-6 border-b border-border-subtle">
              <h3 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-4">Add Channel</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <select
                    value={addType}
                    onChange={e => setAddType(e.target.value as ChannelType)}
                    className="h-9 px-2 rounded-md bg-bg-surface-2 border border-border-default text-sm text-text-primary focus:outline-none focus:border-accent transition-colors duration-[150ms] ease-out"
                  >
                    {(Object.keys(CHANNEL_LABELS) as ChannelType[]).map(t => (
                      <option key={t} value={t}>{CHANNEL_LABELS[t]}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={addDest}
                    onChange={e => setAddDest(e.target.value)}
                    placeholder={addType === 'email' ? 'you@company.com' : addType === 'sms' ? '+91 98765 43210' : addType === 'webhook' ? 'https://...' : 'channel-id or URL'}
                    className="flex-1 h-9 px-3 rounded-md bg-bg-surface-2 border border-border-default text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent transition-colors duration-[150ms] ease-out font-mono"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary w-16">Format:</span>
                  {(Object.keys(FORMAT_LABELS) as Format[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setAddFormat(f)}
                      className={`px-3 h-7 rounded-md text-xs font-medium border transition-colors duration-[150ms] ease-out active:scale-95 ${
                        addFormat === f
                          ? 'border-border-strong bg-bg-surface-3 text-text-primary'
                          : 'border-border-default bg-bg-surface-2 text-text-secondary hover:border-border-muted'
                      }`}
                    >
                      {FORMAT_LABELS[f]}
                    </button>
                  ))}
                  <button
                    onClick={handleAddChannel}
                    disabled={!addDest.trim() || addStatus === 'sending'}
                    className="ml-auto flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-50"
                  >
                    {addStatus === 'sending' ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    Add
                  </button>
                </div>
                {addStatus === 'ok' && <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 size={12} />Channel added. Check for a verification code.</p>}
                {addStatus === 'error' && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12} />Failed to add channel.</p>}
              </div>
            </div>

            {/* OTP verification panel */}
            {verifyId && (
              <div className="p-6 border-b border-border-subtle bg-bg-surface-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-3">Verify Channel</h3>
                <p className="text-xs text-text-muted mb-3">Enter the 6-digit code sent to your destination.</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpInput}
                    onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-32 h-9 px-3 rounded-md bg-bg-surface-3 border border-border-default text-sm font-mono text-text-primary tracking-[0.3em] focus:outline-none focus:border-accent"
                  />
                  <button
                    onClick={handleVerifyOtp}
                    disabled={otpInput.length < 6 || verifyStatus === 'sending'}
                    className="px-3 h-9 rounded-md text-sm font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-50"
                  >
                    {verifyStatus === 'sending' ? 'Verifying…' : 'Verify'}
                  </button>
                  <button
                    onClick={() => { setVerifyId(null); setOtpInput(''); }}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-[150ms] ease-out"
                  >
                    Cancel
                  </button>
                </div>
                {verifyStatus === 'ok'    && <p className="mt-2 text-xs text-green-400">Channel verified.</p>}
                {verifyStatus === 'error' && <p className="mt-2 text-xs text-red-400">Invalid code. Try again.</p>}
              </div>
            )}
          </div>

          {/* Channel Configs */}
          {prefs.channel_configs.length > 0 && (
            <div className="bg-bg-surface border border-border-subtle rounded-md">
              <div className="p-6 border-b border-border-subtle">
                <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1">Channel Routing</h2>
                <p className="text-xs text-text-muted mb-4">Control format and enabled state per channel.</p>
                <div className="space-y-3">
                  {prefs.channel_configs.map((cfg, idx) => (
                    <div key={idx} className="flex items-center gap-3 py-2 border-b border-border-subtle last:border-0">
                      <button
                        onClick={() => toggleConfig(idx)}
                        className={`w-9 h-5 rounded-full relative transition-colors duration-[150ms] ease-out flex-shrink-0 ${cfg.enabled ? 'bg-accent' : 'bg-bg-surface-3'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-colors duration-[150ms] ease-out ${cfg.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                      <span className="w-20 text-sm text-text-primary">{CHANNEL_LABELS[cfg.channel_id]}</span>
                      <span className="flex-1 text-xs text-text-muted font-mono truncate">{cfg.destination_id}</span>
                      <div className="flex items-center gap-1">
                        {(Object.keys(FORMAT_LABELS) as Format[]).map(f => (
                          <button
                            key={f}
                            onClick={() => setConfigFormat(idx, f)}
                            className={`px-2 h-6 rounded text-xs font-medium border transition-colors duration-[150ms] ease-out active:scale-95 ${
                              cfg.format === f
                                ? 'border-border-strong bg-bg-surface-3 text-text-primary'
                                : 'border-transparent text-text-muted hover:text-text-secondary'
                            }`}
                          >
                            {FORMAT_LABELS[f]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Delivery Window */}
          <div className="bg-bg-surface border border-border-subtle rounded-md">
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1">Delivery Window</h2>
              <p className="text-xs text-text-muted mb-4">Alerts outside this window are held and delivered at window start.</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-text-secondary">From</span>
                <select
                  value={prefs.delivery_window.start_hour}
                  onChange={e => setPrefs(p => ({ ...p, delivery_window: { ...p.delivery_window, start_hour: Number(e.target.value) } }))}
                  className="h-8 px-2 rounded-md bg-bg-surface-2 border border-border-default text-sm font-mono text-text-primary focus:outline-none focus:border-accent"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                  ))}
                </select>
                <span className="text-sm text-text-secondary">to</span>
                <select
                  value={prefs.delivery_window.end_hour}
                  onChange={e => setPrefs(p => ({ ...p, delivery_window: { ...p.delivery_window, end_hour: Number(e.target.value) } }))}
                  className="h-8 px-2 rounded-md bg-bg-surface-2 border border-border-default text-sm font-mono text-text-primary focus:outline-none focus:border-accent"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                  ))}
                </select>
                <select
                  value={prefs.delivery_window.timezone}
                  onChange={e => setPrefs(p => ({ ...p, delivery_window: { ...p.delivery_window, timezone: e.target.value } }))}
                  className="h-8 px-2 rounded-md bg-bg-surface-2 border border-border-default text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>

            {/* Priority Threshold */}
            <div className="p-6">
              <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1">Priority Threshold</h2>
              <p className="text-xs text-text-muted mb-4">Only dispatch via these channels for alerts at or above this severity.</p>
              <div className="flex items-center gap-2 flex-wrap">
                {(Object.keys(SEV_COLOR) as Severity[]).map(s => {
                  const active = prefs.priority_threshold === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setPrefs(p => ({ ...p, priority_threshold: s }))}
                      className={`flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium border transition-colors duration-[150ms] ease-out active:scale-95 ${
                        active
                          ? 'border-border-strong bg-bg-surface-3 text-text-primary'
                          : 'border-border-default bg-bg-surface-2 text-text-secondary hover:border-border-muted'
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

            <div className="px-6 py-4 border-t border-border-subtle flex items-center justify-between">
              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-green-400">
                  <CheckCircle2 size={14} />Saved
                </span>
              )}
              <div className="ml-auto">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 h-8 rounded-md text-sm font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-50"
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

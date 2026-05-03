'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Mail, MessageSquare, Webhook } from 'lucide-react';

const STEP = 4;
const TOTAL = 5;

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;

export default function OnboardingAlertsPrefsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState<string[]>(['email']);
  const [threshold, setThreshold] = useState('high');

  function toggleChannel(c: string) {
    setChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  async function handleContinue() {
    setLoading(true);
    try {
      await fetch('/api/onboarding/prefs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channels, severity_threshold: threshold }),
      });
      router.push('/onboarding/demo');
    } finally {
      setLoading(false);
    }
  }

  const CHANNEL_OPTIONS = [
    { id: 'email',    icon: Mail,           label: 'Email',    desc: 'Instant email alerts' },
    { id: 'whatsapp', icon: MessageSquare,   label: 'WhatsApp', desc: 'WhatsApp messages' },
    { id: 'webhook',  icon: Webhook,         label: 'Webhook',  desc: 'POST to your endpoint' },
  ];

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-text-muted mb-2">
          <span>Step {STEP} of {TOTAL}</span>
          <span>{Math.round((STEP / TOTAL) * 100)}%</span>
        </div>
        <div className="h-1 bg-bg-surface-2 rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all duration-300 ease-out" style={{ width: `${(STEP / TOTAL) * 100}%` }} />
        </div>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-md p-8">
        <h1 className="text-xl font-semibold text-text-primary mb-2">Configure your alerts</h1>
        <p className="text-sm text-text-secondary mb-8">Choose how and when you want to be notified.</p>

        <div className="mb-7">
          <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">Alert channels</label>
          <div className="grid grid-cols-3 gap-3">
            {CHANNEL_OPTIONS.map(({ id, icon: Icon, label, desc }) => {
              const active = channels.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleChannel(id)}
                  className={`flex flex-col items-center text-center p-4 rounded-md border transition-colors duration-[150ms] ease-out active:scale-95 ${
                    active
                      ? 'border-accent bg-accent/10 text-text-primary'
                      : 'border-border-default bg-bg-surface-2 text-text-secondary hover:border-border-muted'
                  }`}
                >
                  <Icon size={20} className={`mb-2 ${active ? 'text-accent' : 'text-text-muted'}`} />
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-xs text-text-muted mt-0.5">{desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">Minimum severity threshold</label>
          <div className="flex gap-2">
            {SEVERITIES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setThreshold(s)}
                className={`flex-1 h-8 rounded-md text-xs font-medium capitalize transition-colors duration-[150ms] ease-out active:scale-95 ${
                  threshold === s
                    ? 'bg-accent text-white'
                    : 'bg-bg-surface-2 text-text-secondary hover:bg-bg-surface-3 border border-border-default'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-2">Alerts below this threshold are suppressed.</p>
        </div>

        <div className="flex items-center justify-between">
          <Link
            href="/onboarding/team"
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary transition-colors duration-[150ms] ease-out active:scale-95"
          >
            <ChevronLeft size={14} />
            Back
          </Link>
          <button
            onClick={handleContinue}
            disabled={loading || channels.length === 0}
            className="flex items-center gap-1.5 px-4 h-8 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Continue'}
            {!loading && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

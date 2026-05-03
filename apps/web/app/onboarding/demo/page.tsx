'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, CheckCircle2, ArrowRight } from 'lucide-react';

const STEP = 5;
const TOTAL = 5;

const DEMO_SCENARIOS = [
  { id: 'red-sea', label: 'Red Sea shipping disruption', severity: 'critical', region: 'Middle East' },
  { id: 'india-rain', label: 'Cyclone warning — Gujarat coast', severity: 'high', region: 'South Asia' },
  { id: 'sudan-unrest', label: 'Civil unrest — Khartoum', severity: 'high', region: 'Africa' },
];

export default function OnboardingDemoPage() {
  const router = useRouter();
  const [triggered, setTriggered] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [orgSlug, setOrgSlug] = useState('sundaram-pharma');

  useEffect(() => {
    const stored = sessionStorage.getItem('onboarding_org_slug');
    if (stored) setOrgSlug(stored);
  }, []);

  async function triggerDemo(id: string) {
    setLoading(id);
    try {
      await fetch('/api/onboarding/demo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenarioId: id }),
      });
      setTriggered(id);
    } finally {
      setLoading(null);
    }
  }

  const severityColor: Record<string, string> = {
    critical: 'text-[#EF4444]',
    high: 'text-[#F97316]',
    medium: 'text-[#EAB308]',
  };

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-text-muted mb-2">
          <span>Step {STEP} of {TOTAL}</span>
          <span>100%</span>
        </div>
        <div className="h-1 bg-bg-surface-2 rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all duration-300 ease-out" style={{ width: '100%' }} />
        </div>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-md p-8">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={18} className="text-accent" />
          <h1 className="text-xl font-semibold text-text-primary">See Syntra in action</h1>
        </div>
        <p className="text-sm text-text-secondary mb-8">
          Trigger a demo event to see how an alert looks. This creates a synthetic event matched against your watchlist.
        </p>

        <div className="space-y-3 mb-8">
          {DEMO_SCENARIOS.map(s => (
            <div
              key={s.id}
              className="flex items-center justify-between p-4 rounded-md border border-border-default bg-bg-surface-2"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">{s.label}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  <span className={`font-medium ${severityColor[s.severity] ?? 'text-text-muted'}`}>{s.severity.toUpperCase()}</span>
                  {' · '}{s.region}
                </p>
              </div>
              {triggered === s.id ? (
                <div className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                  <CheckCircle2 size={14} />
                  Triggered
                </div>
              ) : (
                <button
                  onClick={() => triggerDemo(s.id)}
                  disabled={!!loading}
                  className="px-3 h-7 rounded-md text-xs font-medium bg-bg-surface-3 text-text-secondary hover:text-text-primary hover:bg-bg-surface-2 border border-border-default transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-50"
                >
                  {loading === s.id ? 'Triggering…' : 'Trigger demo'}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => router.push(`/app/${orgSlug}`)}
            className="flex items-center gap-1.5 px-5 h-9 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95"
          >
            Go to dashboard
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

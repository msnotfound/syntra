'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, CheckCircle2 } from 'lucide-react';

const PRESETS = [
  {
    id: 'red_sea_strike',
    label: 'Houthi strike — Bab-el-Mandeb',
    description: 'MSC Tavita takes hit; Suez corridor suspended',
    severity: 'CRITICAL',
    region: 'Yemen · Red Sea',
    color: 'text-[#EF4444]',
  },
  {
    id: 'mombasa_closure',
    label: 'Mombasa Port closure — worker lockout',
    description: 'All container berths suspended; vessels to Dar es Salaam',
    severity: 'HIGH',
    region: 'Kenya · East Africa',
    color: 'text-[#F97316]',
  },
  {
    id: 'india_cyclone',
    label: 'Cyclone upgrade — Chennai Port suspended',
    description: 'IMD upgrades to Very Severe; 5–7 day delay minimum',
    severity: 'HIGH',
    region: 'India · Bay of Bengal',
    color: 'text-[#F97316]',
  },
  {
    id: 'nigeria_strike',
    label: 'Apapa Terminal strike — indefinite',
    description: 'NPA force majeure; 14+ day delays expected',
    severity: 'MEDIUM',
    region: 'Nigeria · Lagos',
    color: 'text-[#EAB308]',
  },
];

export default function InjectEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function inject(presetId: string) {
    setLoading(presetId);
    try {
      const res = await fetch('/api/admin/inject-event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ preset: presetId }),
      });
      const data = await res.json();
      if (data.ok) {
        setDone(presetId);
        setTimeout(() => router.push('/app/sundaram-pharma'), 1200);
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Zap size={16} className="text-accent" />
          <h1 className="text-xl font-semibold text-text-primary">Live Event Injection</h1>
        </div>
        <p className="text-sm text-text-secondary">
          Inject a synthetic event, run matching against all active orgs, and redirect to the Sundaram Pharma dashboard to show the live alert.
        </p>
      </div>

      <div className="space-y-3">
        {PRESETS.map(p => (
          <div
            key={p.id}
            className="flex items-center justify-between p-5 rounded-md border border-border-default bg-bg-surface"
            style={{ borderLeft: `3px solid ${{ CRITICAL: '#EF4444', HIGH: '#F97316', MEDIUM: '#EAB308', LOW: '#60A5FA' }[p.severity] ?? '#94A3B8'}` }}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-medium font-mono ${p.color}`}>{p.severity}</span>
                <span className="text-xs text-text-muted">·</span>
                <span className="text-xs text-text-muted">{p.region}</span>
              </div>
              <p className="text-sm font-semibold text-text-primary">{p.label}</p>
              <p className="text-xs text-text-secondary mt-0.5">{p.description}</p>
            </div>

            <div className="ml-6 flex-shrink-0">
              {done === p.id ? (
                <div className="flex items-center gap-1.5 text-sm text-green-400 font-medium">
                  <CheckCircle2 size={15} />
                  Injected — redirecting…
                </div>
              ) : (
                <button
                  onClick={() => inject(p.id)}
                  disabled={!!loading || !!done}
                  className="flex items-center gap-1.5 px-4 h-9 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-50"
                >
                  {loading === p.id ? (
                    <>
                      <span className="animate-spin inline-block w-3.5 h-3.5 border border-white border-t-transparent rounded-full" />
                      Injecting…
                    </>
                  ) : (
                    <>
                      <Zap size={13} />
                      Inject live
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-text-muted">
        After injection, matching runs synchronously in-process (no worker needed). You'll be redirected to the Sundaram Pharma dashboard to show the alert appearing live.
      </p>
    </div>
  );
}

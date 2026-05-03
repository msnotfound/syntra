'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

const STEP = 1;
const TOTAL = 5;

export default function OnboardingOrgPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', industry: '', size: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/onboarding/org', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      router.push('/onboarding/watchlist');
    } finally {
      setLoading(false);
    }
  }

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
        <h1 className="text-xl font-semibold text-text-primary mb-2">Tell us about your organisation</h1>
        <p className="text-sm text-text-secondary mb-8">We use this to tailor alerts and LLM context to your industry.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">Organisation name</label>
            <input
              required
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Sundaram Pharma Ltd."
              className="w-full h-9 px-3 rounded-md bg-bg-surface-2 border border-border-default text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent transition-colors duration-[150ms] ease-out"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">Industry</label>
            <select
              required
              value={form.industry}
              onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
              className="w-full h-9 px-3 rounded-md bg-bg-surface-2 border border-border-default text-sm text-text-primary focus:outline-none focus:border-accent transition-colors duration-[150ms] ease-out"
            >
              <option value="">Select industry…</option>
              {['Pharmaceuticals', 'Logistics & Shipping', 'Manufacturing', 'Energy & Oil', 'Financial Services', 'Technology', 'Retail & FMCG', 'Agriculture', 'Other'].map(i => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">Company size</label>
            <select
              value={form.size}
              onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
              className="w-full h-9 px-3 rounded-md bg-bg-surface-2 border border-border-default text-sm text-text-primary focus:outline-none focus:border-accent transition-colors duration-[150ms] ease-out"
            >
              <option value="">Select size…</option>
              {['1–10', '11–50', '51–200', '201–500', '500+'].map(s => (
                <option key={s} value={s}>{s} employees</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 h-8 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Continue'}
              {!loading && <ChevronRight size={14} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

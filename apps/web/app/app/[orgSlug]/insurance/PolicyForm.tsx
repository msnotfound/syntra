'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const COVERAGE_TYPES = [
  { value: 'marine', label: 'Marine' },
  { value: 'cargo', label: 'Cargo' },
  { value: 'trade_credit', label: 'Trade Credit' },
  { value: 'political_risk', label: 'Political Risk' },
  { value: 'other', label: 'Other' },
] as const;

interface PolicyFormProps { orgSlug: string }

export function PolicyForm({ orgSlug }: PolicyFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    const res = await fetch('/api/v1/insurance/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        policy_id: data.policy_id,
        insurer_name: data.insurer_name,
        coverage_type: data.coverage_type,
        max_payout_usd: Number(data.max_payout_usd),
        aggregate_limit_usd: data.aggregate_limit_usd ? Number(data.aggregate_limit_usd) : undefined,
        deductible_usd: Number(data.deductible_usd || 0),
        expires_at: new Date(data.expires_at as string).toISOString(),
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.message ?? 'Failed to add policy');
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-3 gap-3">
      {[
        { name: 'policy_id', label: 'Policy ID', placeholder: 'POL-2024-001', type: 'text' },
        { name: 'insurer_name', label: 'Insurer', placeholder: 'ICICI Lombard', type: 'text' },
      ].map(f => (
        <div key={f.name}>
          <label className="block text-xs text-text-secondary mb-1">{f.label}</label>
          <input
            name={f.name}
            type={f.type}
            placeholder={f.placeholder}
            required
            className="w-full h-8 px-3 rounded-md bg-bg-surface-3 border border-border-default text-sm text-text-primary placeholder:text-text-disabled focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent transition-colors duration-[150ms]"
          />
        </div>
      ))}

      <div>
        <label className="block text-xs text-text-secondary mb-1">Coverage Type</label>
        <select
          name="coverage_type"
          required
          className="w-full h-8 px-3 rounded-md bg-bg-surface-3 border border-border-default text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent transition-colors duration-[150ms]"
        >
          {COVERAGE_TYPES.map(ct => (
            <option key={ct.value} value={ct.value}>{ct.label}</option>
          ))}
        </select>
      </div>

      {[
        { name: 'max_payout_usd', label: 'Max Payout (USD)', placeholder: '5000000' },
        { name: 'aggregate_limit_usd', label: 'Aggregate Limit (USD)', placeholder: '4000000' },
        { name: 'deductible_usd', label: 'Deductible (USD)', placeholder: '50000' },
      ].map(f => (
        <div key={f.name}>
          <label className="block text-xs text-text-secondary mb-1">{f.label}</label>
          <input
            name={f.name}
            type="number"
            min="0"
            step="1"
            placeholder={f.placeholder}
            required={f.name === 'max_payout_usd'}
            className="w-full h-8 px-3 rounded-md bg-bg-surface-3 border border-border-default text-sm text-text-primary font-mono placeholder:text-text-disabled focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent transition-colors duration-[150ms]"
          />
        </div>
      ))}

      <div>
        <label className="block text-xs text-text-secondary mb-1">Expiry Date</label>
        <input
          name="expires_at"
          type="date"
          required
          className="w-full h-8 px-3 rounded-md bg-bg-surface-3 border border-border-default text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent transition-colors duration-[150ms]"
        />
      </div>

      <div className="col-span-3 flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 h-8 rounded-md text-sm font-medium bg-accent text-text-primary hover:bg-accent-hover disabled:opacity-50 transition-colors duration-[150ms] ease-out active:scale-95"
        >
          {submitting ? 'Adding…' : 'Add Policy'}
        </button>
        {error && <span className="text-sm text-severity-critical">{error}</span>}
      </div>
    </form>
  );
}

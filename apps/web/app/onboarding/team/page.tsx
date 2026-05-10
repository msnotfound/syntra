'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';

const STEP = 3;
const TOTAL = 5;

export default function OnboardingTeamPage() {
  const router = useRouter();
  const [emails, setEmails] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);

  function addRow() { setEmails(prev => [...prev, '']); }
  function removeRow(i: number) { setEmails(prev => prev.filter((_, idx) => idx !== i)); }
  function updateRow(i: number, val: string) { setEmails(prev => prev.map((e, idx) => idx === i ? val : e)); }

  async function handleContinue() {
    const valid = emails.filter(e => e.trim() && e.includes('@'));
    setLoading(true);
    try {
      if (valid.length) {
        await fetch('/api/onboarding/invite', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ emails: valid }),
        });
      }
      router.push('/onboarding/alerts-prefs');
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
          <div className="h-full bg-accent rounded-full transition-colors duration-300 ease-out" style={{ width: `${(STEP / TOTAL) * 100}%` }} />
        </div>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-md p-8">
        <h1 className="text-xl font-semibold text-text-primary mb-2">Invite your team</h1>
        <p className="text-sm text-text-secondary mb-8">Add colleagues who should receive alerts. You can skip this and invite later from Settings.</p>

        <div className="space-y-2 mb-4">
          {emails.map((email, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={e => updateRow(i, e.target.value)}
                placeholder="colleague@company.com"
                className="flex-1 h-9 px-3 rounded-md bg-bg-surface-2 border border-border-default text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent transition-colors duration-[150ms] ease-out"
              />
              {emails.length > 1 && (
                <button onClick={() => removeRow(i)} className="p-1 text-text-muted hover:text-text-secondary transition-colors duration-[150ms]">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors duration-[150ms] ease-out mb-8"
        >
          <Plus size={14} />
          Add another
        </button>

        <div className="flex items-center justify-between">
          <Link
            href="/onboarding/watchlist"
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary transition-colors duration-[150ms] ease-out active:scale-95"
          >
            <ChevronLeft size={14} />
            Back
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/onboarding/alerts-prefs"
              className="px-3 h-8 rounded-md text-sm font-medium text-text-secondary hover:bg-bg-surface-2 hover:text-text-primary transition-colors duration-[150ms] ease-out active:scale-95"
            >
              Skip for now
            </Link>
            <button
              onClick={handleContinue}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 h-8 rounded-md text-sm font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send invites'}
              {!loading && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

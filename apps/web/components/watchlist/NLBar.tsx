'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X, Check } from 'lucide-react';

interface EntityRef {
  id: string;
  name: string;
  type: string;
}

interface UpdateAction {
  field: string;
  from: string;
  to: string;
}

interface NLActions {
  add: string[];
  remove: EntityRef[];
  update: UpdateAction[];
}

interface NLQueryResult {
  parsed: {
    summary: string;
    confidence: number;
  };
  actions: NLActions;
}

interface NLBarProps {
  orgSlug: string;
}

export function NLBar({ orgSlug }: NLBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NLQueryResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setDone(false);

    try {
      const res = await fetch('/api/v1/watchlist/nl-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), orgSlug }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? 'Failed to parse query');
        return;
      }
      setResult(json.data);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!result || confirming) return;
    setConfirming(true);
    try {
      const removeIds = result.actions.remove.map(e => e.id);
      if (removeIds.length > 0) {
        const res = await fetch('/api/v1/watchlist/nl-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, orgSlug, confirm: true, removeIds }),
        });
        if (!res.ok) {
          const json = await res.json();
          setError(json.message ?? 'Failed to apply changes');
          return;
        }
      }
      setDone(true);
      setResult(null);
      setPrompt('');
      router.refresh();
    } catch {
      setError('Failed to apply changes.');
    } finally {
      setConfirming(false);
    }
  };

  const handleDismiss = () => {
    setResult(null);
    setError(null);
    setDone(false);
  };

  const hasChanges =
    result && (result.actions.add.length > 0 || result.actions.remove.length > 0 || result.actions.update.length > 0);

  return (
    <div className="relative">
      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div
          className="flex items-center gap-2 flex-1 px-3 h-9 rounded-md bg-bg-surface-3 border border-border-default focus-within:border-accent transition-colors duration-[150ms] ease-out"
          style={{ transition: 'border-color 150ms ease-out' }}
        >
          {loading
            ? <span className="skeleton h-3.5 w-3.5 shrink-0 rounded-sm" aria-hidden="true" />
            : <Sparkles size={14} className="text-accent shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe what to watch… e.g. &ldquo;Track pharma suppliers in India&rdquo;"
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none disabled:opacity-50"
          />
          {prompt && (
            <button
              type="button"
              onClick={() => setPrompt('')}
              aria-label="Clear prompt"
              title="Clear prompt"
              className="text-text-muted hover:text-text-secondary transition-colors duration-[150ms] ease-out"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={!prompt.trim() || loading}
          className="px-3 h-9 rounded-md text-sm font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Parse
        </button>
      </form>

      {/* Error */}
      {error && (
        <p className="mt-1.5 text-xs text-severity-critical">{error}</p>
      )}

      {/* Done */}
      {done && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-text-secondary">
          <Check size={12} className="text-accent" />
          Watchlist updated.
        </div>
      )}

      {/* Confirmation modal */}
      {result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) handleDismiss(); }}
        >
          <div
            className="w-full max-w-md bg-bg-surface border border-border-default rounded-md p-6"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Confirm watchlist update</h2>
                <p className="text-sm text-text-secondary mt-0.5">{result.parsed.summary}</p>
              </div>
              <button
                onClick={handleDismiss}
                aria-label="Close confirmation"
                title="Close confirmation"
                className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-surface-2 transition-colors duration-[150ms] ease-out"
              >
                <X size={14} />
              </button>
            </div>

            {/* Confidence */}
            <div className="mb-4 px-3 py-2 rounded-md bg-bg-surface-2 border border-border-subtle text-xs text-text-muted font-mono">
              Parse confidence: {Math.round(result.parsed.confidence * 100)}%
            </div>

            {/* Proposed changes */}
            {!hasChanges ? (
              <p className="text-sm text-text-muted mb-4">No changes proposed for this query.</p>
            ) : (
              <div className="space-y-3 mb-4">
                {result.actions.add.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1.5">Will ADD</p>
                    <ul className="space-y-1">
                      {result.actions.add.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-text-primary">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.actions.remove.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1.5">Will REMOVE</p>
                    <ul className="space-y-1">
                      {result.actions.remove.map(e => (
                        <li key={e.id} className="flex items-center gap-2 text-sm text-text-primary">
                          <span className="w-1.5 h-1.5 rounded-full bg-severity-high shrink-0" />
                          <span>{e.name}</span>
                          <span className="text-xs text-text-muted capitalize">{e.type}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.actions.update.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1.5">Will UPDATE</p>
                    <ul className="space-y-1">
                      {result.actions.update.map((u, i) => (
                        <li key={i} className="text-sm text-text-primary">
                          <span className="text-text-muted">{u.field}: </span>
                          <span className="line-through text-text-muted">{u.from}</span>
                          <span className="mx-1 text-text-muted">→</span>
                          <span className="font-medium">{u.to}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
              <button
                onClick={handleDismiss}
                className="px-3 h-8 rounded-md text-sm font-medium text-text-secondary bg-bg-surface-2 border border-border-default hover:text-text-primary hover:bg-bg-surface-3 transition-colors duration-[150ms] ease-out active:scale-95"
              >
                Cancel
              </button>
              {hasChanges && (
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-40"
                >
                  {confirming && <span className="skeleton h-3 w-3 rounded-sm" aria-hidden="true" />}
                  Confirm
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

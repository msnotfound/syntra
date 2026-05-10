'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Sparkles, X } from 'lucide-react';

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

interface NLPlanAction {
  intent: string;
  summary: string;
  entity_ids: string[];
}

interface NLQueryResult {
  conversation_id: string;
  parsed: {
    summary: string;
    confidence: number;
  };
  actions: NLActions;
  plan?: NLPlanAction[];
  status?: 'ready' | 'clarification';
  clarification?: {
    question: string;
    options: string[];
  } | null;
}

interface NLBarProps {
  orgSlug: string;
}

export function NLBar({ orgSlug }: NLBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
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
        body: JSON.stringify({
          prompt: prompt.trim(),
          orgSlug,
          conversation_id: conversationId ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? 'Failed to parse query');
        return;
      }
      setConversationId(json.data.conversation_id);
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
      const removeIds = result.actions.remove.map(entity => entity.id);
      if (removeIds.length > 0) {
        const res = await fetch('/api/v1/watchlist/nl-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            orgSlug,
            conversation_id: result.conversation_id,
            confirm: true,
            removeIds,
          }),
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
      inputRef.current?.focus();
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
  const planCount = result?.plan?.reduce((total, action) => total + action.entity_ids.length, 0) ?? 0;

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="flex h-9 flex-1 items-center gap-2 rounded-md border border-border-default bg-bg-surface-3 px-3 transition-colors duration-[150ms] ease-out focus-within:border-accent">
          {loading
            ? <span className="skeleton h-3.5 w-3.5 shrink-0 rounded-sm" aria-hidden="true" />
            : <Sparkles size={14} className="shrink-0 text-accent" />
          }
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder='Describe what to watch... e.g. "Track pharma suppliers in India"'
            disabled={loading}
            className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted disabled:opacity-50"
          />
          {prompt && (
            <button
              type="button"
              onClick={() => setPrompt('')}
              aria-label="Clear prompt"
              title="Clear prompt"
              className="text-text-muted transition-colors duration-[150ms] ease-out hover:text-text-secondary"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={!prompt.trim() || loading}
          className="h-9 rounded-md bg-accent px-3 text-sm font-medium text-text-primary transition-colors duration-[150ms] ease-out hover:bg-accent-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Parse
        </button>
      </form>

      {error && <p className="mt-1.5 text-xs text-severity-critical">{error}</p>}

      {done && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-text-secondary">
          <Check size={12} className="text-accent" />
          Watchlist updated.
        </div>
      )}

      {result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={e => { if (e.target === e.currentTarget) handleDismiss(); }}
        >
          <div className="w-full max-w-md rounded-md border border-border-default bg-bg-surface p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  {result.status === 'clarification' ? 'Clarify watchlist query' : 'Confirm watchlist update'}
                </h2>
                <p className="mt-0.5 text-sm text-text-secondary">
                  {result.clarification?.question ?? result.parsed.summary}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                aria-label="Close confirmation"
                title="Close confirmation"
                className="rounded p-1 text-text-muted transition-colors duration-[150ms] ease-out hover:bg-bg-surface-2 hover:text-text-primary"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mb-4 rounded-md border border-border-subtle bg-bg-surface-2 px-3 py-2 font-mono text-xs text-text-muted">
              Parse confidence: {Math.round(result.parsed.confidence * 100)}%
              {planCount > 0 ? ` | ${planCount} matched entities` : ''}
            </div>

            {result.clarification ? (
              <div className="mb-4 space-y-2">
                {result.clarification.options.map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPrompt(option)}
                    className="block w-full rounded-md border border-border-default bg-bg-surface-2 px-3 py-2 text-left text-sm text-text-primary transition-colors duration-[150ms] ease-out hover:bg-bg-surface-3"
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : !hasChanges ? (
              <p className="mb-4 text-sm text-text-muted">No changes proposed for this query.</p>
            ) : (
              <div className="mb-4 space-y-3">
                {result.actions.add.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">Will ADD</p>
                    <ul className="space-y-1">
                      {result.actions.add.map((item, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm text-text-primary">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.actions.remove.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">Will REMOVE</p>
                    <ul className="space-y-1">
                      {result.actions.remove.map(entity => (
                        <li key={entity.id} className="flex items-center gap-2 text-sm text-text-primary">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-severity-high" />
                          <span>{entity.name}</span>
                          <span className="text-xs capitalize text-text-muted">{entity.type}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.actions.update.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary">Will UPDATE</p>
                    <ul className="space-y-1">
                      {result.actions.update.map((update, index) => (
                        <li key={index} className="text-sm text-text-primary">
                          <span className="text-text-muted">{update.field}: </span>
                          <span className="line-through text-text-muted">{update.from}</span>
                          <span className="mx-1 text-text-muted">-&gt;</span>
                          <span className="font-medium">{update.to}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-3">
              <button
                onClick={handleDismiss}
                className="h-8 rounded-md border border-border-default bg-bg-surface-2 px-3 text-sm font-medium text-text-secondary transition-colors duration-[150ms] ease-out hover:bg-bg-surface-3 hover:text-text-primary active:scale-95"
              >
                Cancel
              </button>
              {hasChanges && (
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-text-primary transition-colors duration-[150ms] ease-out hover:bg-accent-hover active:scale-95 disabled:opacity-40"
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

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, Loader2 } from 'lucide-react';

interface Props { orgSlug: string }

export function ResearchComposer({ orgSlug }: Props) {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (question.trim().length < 10) {
      setError('Question must be at least 10 characters.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/v1/research/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? 'Failed to start research session.');
        return;
      }
      const id = json.data?.session?._id;
      router.push(`/app/${orgSlug}/research/${id}`);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-bg-surface border border-border-subtle rounded-sm p-4 space-y-2">
      <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
        Research question
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <textarea
            className="w-full bg-bg-surface-2 border border-border-subtle rounded-sm pl-8 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-border-default transition-colors duration-quick"
            rows={2}
            placeholder="e.g. Impact of Red Sea closure on Indian generics export to EU"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
          />
        </div>
        <button
          type="button"
          disabled={loading || question.trim().length < 10}
          onClick={submit}
          className="flex items-center gap-2 px-4 h-full rounded-sm text-sm font-medium bg-accent text-text-primary hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-quick active:scale-95"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
          {loading ? 'Starting…' : 'Research'}
        </button>
      </div>
      {error && <p className="text-xs text-severity-critical">{error}</p>}
      <p className="text-xs text-text-muted">⌘+Enter to submit</p>
    </div>
  );
}

'use client';

import { useState, useRef } from 'react';
import { Send } from 'lucide-react';
import { TimeAgo } from '@syntra/ui/components/TimeAgo';

export interface Comment {
  user_id: string;
  body: string;
  created_at: Date | string;
  user_name?: string;
}

interface CommentThreadProps {
  alertId: string;
  orgSlug: string;
  initialComments: Comment[];
}

export function CommentThread({ alertId, orgSlug, initialComments }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/triage/${alertId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? 'Failed to post comment');
        return;
      }
      setComments(prev => [...prev, { ...json.data.comment }]);
      setBody('');
      textareaRef.current?.focus();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-1">
        Comments
      </div>

      {comments.length === 0 && (
        <p className="text-xs text-text-muted py-2">No comments yet.</p>
      )}

      <div className="space-y-3">
        {comments.map((c, i) => (
          <div key={i} className="flex gap-2.5">
            <div className="w-6 h-6 rounded-sm bg-bg-surface-3 flex items-center justify-center text-xs font-mono text-text-muted flex-shrink-0 mt-0.5">
              {(c.user_name ?? c.user_id).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-xs font-medium text-text-secondary">
                  {c.user_name ?? 'Team member'}
                </span>
                <TimeAgo
                  date={new Date(c.created_at)}
                  className="text-xs font-mono text-text-muted"
                />
              </div>
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{c.body}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-2">
        <div className="rounded-md border border-border-default bg-bg-surface-3 focus-within:border-accent transition-colors duration-[150ms] ease-out">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as React.FormEvent);
            }}
            placeholder="Add a comment… (Cmd+Enter to submit)"
            rows={3}
            className="w-full bg-transparent px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none outline-none"
          />
          <div className="flex items-center justify-between px-3 py-2 border-t border-border-subtle">
            {error && <span className="text-xs text-severity-critical">{error}</span>}
            {!error && <span className="text-xs text-text-muted">Cmd+Enter to submit</span>}
            <button
              type="submit"
              disabled={!body.trim() || submitting}
              className="flex items-center gap-1.5 px-3 h-7 rounded-sm text-xs font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
            >
              <Send size={12} />
              {submitting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

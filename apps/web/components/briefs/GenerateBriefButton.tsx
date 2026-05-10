'use client';

import { useState } from 'react';
import { FileText, Check, Copy, Loader2 } from 'lucide-react';

interface Props {
  alertId: string;
  orgSlug: string;
}

type State = 'idle' | 'loading' | 'done' | 'error';

export function GenerateBriefButton({ alertId, orgSlug }: Props) {
  const [state, setState] = useState<State>('idle');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setState('loading');
    try {
      const res = await fetch('/api/v1/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const json = await res.json();
      const token = json.data?.share_token as string;
      const fullUrl = `${window.location.origin}/api/v1/briefs/share/${token}/view`;
      setShareUrl(fullUrl);
      setState('done');
    } catch {
      setState('error');
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (state === 'done' && shareUrl) {
    return (
      <div className="flex items-center gap-2">
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95"
        >
          <FileText size={14} />
          View PDF
        </a>
        <button
          onClick={copyLink}
          title="Copy share link"
          className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-bg-surface-2 border border-border-default text-text-primary hover:bg-bg-surface-3 transition-colors duration-[150ms] ease-out active:scale-95"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={state === 'loading'}
      className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-bg-surface-2 border border-border-default text-text-primary hover:bg-bg-surface-3 transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {state === 'loading' ? (
        <Loader2 size={14} className="animate-spin" />
      ) : state === 'error' ? (
        <FileText size={14} className="text-severity-high" />
      ) : (
        <FileText size={14} />
      )}
      {state === 'loading' ? 'Generating…' : state === 'error' ? 'Retry' : 'Generate Brief'}
    </button>
  );
}

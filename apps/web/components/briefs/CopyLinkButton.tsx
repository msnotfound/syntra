'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  shareUrl: string;
}

export function CopyLinkButton({ shareUrl }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy share link"
      className="flex items-center gap-1 px-2 h-7 rounded-sm text-xs font-medium bg-bg-surface-2 border border-border-default text-text-primary hover:bg-bg-surface-3 transition-colors duration-[150ms] ease-out"
    >
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

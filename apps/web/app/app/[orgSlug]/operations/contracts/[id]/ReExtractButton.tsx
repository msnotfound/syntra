'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface ReExtractButtonProps {
  contractId: string;
  docUrl: string | null;
}

export function ReExtractButton({ contractId, docUrl }: ReExtractButtonProps) {
  const [status, setStatus] = useState<'idle' | 'queued' | 'error'>('idle');

  async function reExtract() {
    if (!docUrl) return;
    setStatus('idle');
    const res = await fetch('/api/v1/contracts/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contract_id: contractId, doc_url: docUrl, force: true }),
    });
    setStatus(res.ok ? 'queued' : 'error');
  }

  return (
    <button
      type="button"
      onClick={reExtract}
      disabled={!docUrl || status === 'queued'}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-subtle px-3 text-xs font-medium text-text-secondary transition-colors duration-[150ms] hover:border-accent hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshCw size={13} />
      {status === 'queued' ? 'Queued' : status === 'error' ? 'Retry failed' : 'Re-extract'}
    </button>
  );
}

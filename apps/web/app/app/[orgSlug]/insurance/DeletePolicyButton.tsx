'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeletePolicyButton({ policyId }: { policyId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!confirm('Delete this policy? This cannot be undone.')) return;
    setBusy(true);
    await fetch(`/api/v1/insurance/policies/${policyId}`, { method: 'DELETE' });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="text-xs text-text-muted hover:text-severity-critical disabled:opacity-50 transition-colors duration-[150ms]"
    >
      {busy ? '…' : 'Delete'}
    </button>
  );
}

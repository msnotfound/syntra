'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';

interface StartWarRoomButtonProps {
  alertId: string;
  alertTitle: string;
  orgSlug: string;
}

export function StartWarRoomButton({ alertId, alertTitle, orgSlug }: StartWarRoomButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/war-rooms', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:     `War Room: ${alertTitle.slice(0, 160)}`,
          alert_id: alertId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/app/${orgSlug}/war-rooms/${data.data.id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium border border-severity-critical bg-bg-surface text-severity-critical transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-60"
    >
      <Shield size={14} />
      {loading ? 'Opening…' : 'Start War Room'}
    </button>
  );
}

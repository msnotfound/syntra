'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ExposureData {
  var_value_usd: number;
  var_value_inr: number;
  exposure_delta_usd: number | null;
  computed_at: string;
}

interface LiveExposureSidebarProps {
  roomId: string;
  alertId: string | null;
}

const USD_M_FMT = (n: number) => {
  const m = n / 1_000_000;
  return `$${m.toFixed(2)}M`;
};

export function LiveExposureSidebar({ roomId, alertId }: LiveExposureSidebarProps) {
  const [exposure, setExposure] = useState<ExposureData | null>(null);

  useEffect(() => {
    if (!alertId) return;

    const es = new EventSource(`/api/v1/war-rooms/${roomId}/exposure-stream`);

    es.addEventListener('exposure', (e) => {
      try {
        const data = JSON.parse(e.data) as ExposureData;
        setExposure(data);
      } catch {
        // malformed event — ignore
      }
    });

    es.onerror = () => {
      // Browser auto-reconnects
    };

    return () => es.close();
  }, [roomId, alertId]);

  if (!alertId) return null;

  const delta = exposure?.exposure_delta_usd ?? null;
  const improved = delta !== null && delta < 0;
  const worsened = delta !== null && delta > 0;

  return (
    <div className="rounded-md border border-border-subtle bg-bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Live Exposure</span>
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            exposure ? 'bg-severity-low animate-pulse' : 'bg-text-disabled'
          }`}
        />
      </div>

      <div className="px-4 py-3">
        {!exposure ? (
          <p className="text-xs text-text-muted">Waiting for data…</p>
        ) : (
          <div className="space-y-2">
            <div>
              <p className="text-xs text-text-muted mb-0.5">Value at Risk</p>
              <p className="text-2xl font-mono font-semibold text-text-primary">
                {USD_M_FMT(exposure.var_value_usd)}
              </p>
            </div>

            {delta !== null && delta !== 0 && (
              <div className={`flex items-center gap-1.5 text-xs font-mono ${
                improved ? 'text-severity-low' : 'text-severity-critical'
              }`}>
                {improved ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                <span>
                  {improved ? '↓' : '↑'}{USD_M_FMT(Math.abs(delta))} vs prior
                </span>
              </div>
            )}

            <p className="text-xs text-text-disabled font-mono">
              {new Date(exposure.computed_at).toLocaleTimeString('en-IN', { timeStyle: 'short' })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

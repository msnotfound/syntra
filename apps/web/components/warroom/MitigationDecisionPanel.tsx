'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, CheckCircle, XCircle } from 'lucide-react';

type MitigationType = 'alt_route' | 'alt_supplier' | 'inventory_buffer' | 'contract_clause';
type MitigationStatus = 'proposed' | 'accepted' | 'rejected';

interface MitigationSuggestion {
  id: string;
  suggestion_type: MitigationType;
  narrative: string;
  confidence_pct: number;
  estimated_var_reduction_usd: number | null;
  status: MitigationStatus;
}

interface MitigationDecisionPanelProps {
  alertId: string | null;
}

const TYPE_LABELS: Record<MitigationType, string> = {
  alt_route:        'Alt Route',
  alt_supplier:     'Alt Supplier',
  inventory_buffer: 'Inventory Buffer',
  contract_clause:  'Contract Clause',
};

const USD_FMT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

export function MitigationDecisionPanel({ alertId }: MitigationDecisionPanelProps) {
  const [suggestions, setSuggestions] = useState<MitigationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!alertId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/alerts/${alertId}/mitigations`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, status: 'accepted' | 'rejected') => {
    if (!alertId || acting) return;
    setActing(id);
    try {
      const res = await fetch(`/api/v1/alerts/${alertId}/mitigations/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      });
      if (res.ok) {
        setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
      }
    } finally {
      setActing(null);
    }
  };

  if (!alertId) {
    return (
      <div className="rounded-md border border-border-subtle bg-bg-surface px-4 py-3">
        <p className="text-xs text-text-muted">No alert linked to this room.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border-subtle bg-bg-surface overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border-subtle">
        <Shield size={12} className="text-text-muted" />
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Mitigations</span>
        {!loading && (
          <span className="text-xs font-mono text-text-muted">
            {suggestions.filter(s => s.status === 'proposed').length} proposed
          </span>
        )}
      </div>

      {loading && (
        <div className="px-4 py-3">
          <p className="text-xs text-text-muted">Loading…</p>
        </div>
      )}

      <div className="divide-y divide-border-subtle">
        {!loading && suggestions.length === 0 && (
          <p className="text-xs text-text-muted px-4 py-3">No mitigation suggestions yet.</p>
        )}
        {suggestions.map(s => (
          <div key={s.id} className="px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs px-1.5 py-0.5 rounded-sm bg-bg-surface-2 text-text-muted font-mono">
                {TYPE_LABELS[s.suggestion_type]}
              </span>
              <span className="text-xs text-text-muted">{s.confidence_pct}% confidence</span>
              {s.estimated_var_reduction_usd && (
                <span className="text-xs text-severity-low">
                  −{USD_FMT.format(s.estimated_var_reduction_usd)} VaR
                </span>
              )}
            </div>
            <p className="text-sm text-text-primary leading-snug">{s.narrative}</p>
            {s.status === 'proposed' && (
              <div className="flex gap-2 pt-0.5">
                <button
                  onClick={() => act(s.id, 'accepted')}
                  disabled={acting === s.id}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-sm bg-severity-low/10 text-severity-low transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle size={10} />
                  Accept
                </button>
                <button
                  onClick={() => act(s.id, 'rejected')}
                  disabled={acting === s.id}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-sm bg-bg-surface-2 text-text-muted transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-50"
                >
                  <XCircle size={10} />
                  Reject
                </button>
              </div>
            )}
            {s.status !== 'proposed' && (
              <span className={`text-xs px-1.5 py-0.5 rounded-sm ${
                s.status === 'accepted' ? 'bg-severity-low/10 text-severity-low' : 'bg-bg-surface-2 text-text-disabled'
              }`}>
                {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

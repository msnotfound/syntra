'use client';

import { useState } from 'react';
import { ClipboardList, X } from 'lucide-react';

const DECISION_TYPES = [
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'closed', label: 'Closed' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'mitigation_chosen', label: 'Mitigation chosen' },
] as const;

type DecisionType = (typeof DECISION_TYPES)[number]['value'];

interface LogDecisionModalProps {
  alertId: string;
  orgSlug: string;
  onSuccess?: () => void;
}

export function LogDecisionModal({ alertId, orgSlug, onSuccess }: LogDecisionModalProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DecisionType>('acknowledged');
  const [text, setText] = useState('');
  const [justification, setJustification] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openModal() {
    setError(null);
    setText('');
    setJustification('');
    setType('acknowledged');
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) { setError('Decision text is required.'); return; }
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_id: alertId,
          decision_type: type,
          decision_text: text.trim(),
          justification: justification.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error?.message ?? 'Failed to save decision.');
        return;
      }
      setOpen(false);
      onSuccess?.();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-bg-surface-2 border border-border-default text-text-primary hover:bg-bg-surface-3 transition-colors duration-[150ms] ease-out active:scale-95"
      >
        <ClipboardList size={14} />
        Log decision
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-md bg-bg-surface border border-border-default rounded-md shadow-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Log Decision</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-text-muted hover:text-text-primary transition-colors duration-[150ms]"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Decision type */}
              <div>
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                  Type
                </label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as DecisionType)}
                  className="w-full h-8 px-2 rounded-md text-sm bg-bg-surface-2 border border-border-default text-text-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[#3B82F6]"
                >
                  {DECISION_TYPES.map(dt => (
                    <option key={dt.value} value={dt.value}>{dt.label}</option>
                  ))}
                </select>
              </div>

              {/* Decision text */}
              <div>
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                  Decision <span className="text-severity-critical">*</span>
                </label>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Describe the decision taken..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-md text-sm bg-bg-surface-2 border border-border-default text-text-primary placeholder:text-text-muted resize-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[#3B82F6]"
                />
              </div>

              {/* Justification */}
              <div>
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                  Justification
                </label>
                <textarea
                  value={justification}
                  onChange={e => setJustification(e.target.value)}
                  placeholder="Why was this decision made? (optional)"
                  rows={2}
                  className="w-full px-3 py-2 rounded-md text-sm bg-bg-surface-2 border border-border-default text-text-primary placeholder:text-text-muted resize-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[#3B82F6]"
                />
              </div>

              {error && (
                <p className="text-xs text-severity-critical">{error}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 h-8 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface-2 transition-colors duration-[150ms] ease-out"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 h-8 rounded-md text-sm font-medium bg-accent text-white hover:opacity-90 transition-opacity duration-[150ms] ease-out active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import { useState } from 'react';
import { CheckCircle, X, UserCheck, ChevronDown } from 'lucide-react';

export interface OrgMember {
  id: string;
  name: string;
  email: string;
}

interface TriageControlsProps {
  alertId: string;
  currentStatus: 'open' | 'triaged' | 'closed';
  currentAssigneeId: string | null;
  members: OrgMember[];
}

export function TriageControls({ alertId, currentStatus, currentAssigneeId, members }: TriageControlsProps) {
  const [status, setStatus] = useState(currentStatus);
  const [assigneeId, setAssigneeId] = useState<string | null>(currentAssigneeId);
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentAssignee = members.find(m => m.id === assigneeId);

  async function updateAssignee(userId: string | null) {
    setBusy(true);
    setError(null);
    setAssignDropdownOpen(false);
    try {
      const res = await fetch(`/api/v1/triage/${alertId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee_user_id: userId }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json?.error?.message ?? 'Failed to assign');
        return;
      }
      setAssigneeId(userId);
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(newStatus: 'open' | 'triaged' | 'closed') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/triage/${alertId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json?.error?.message ?? 'Failed to update status');
        return;
      }
      setStatus(newStatus);
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="text-xs text-severity-critical">{error}</p>
      )}

      {/* Assign dropdown */}
      <div className="relative">
        <button
          onClick={() => setAssignDropdownOpen(o => !o)}
          disabled={busy}
          className="w-full flex items-center justify-between gap-2 px-3 h-8 rounded-md text-sm bg-bg-surface-2 border border-border-default text-text-primary hover:bg-bg-surface-3 transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
        >
          <div className="flex items-center gap-1.5">
            <UserCheck size={13} className="text-text-secondary" />
            <span className="text-sm">{currentAssignee ? currentAssignee.name : 'Unassigned'}</span>
          </div>
          <ChevronDown size={13} className="text-text-muted" />
        </button>

        {assignDropdownOpen && (
          <div className="absolute top-full mt-1 left-0 right-0 z-10 bg-bg-surface border border-border-default rounded-md shadow-lg overflow-hidden">
            <button
              onClick={() => updateAssignee(null)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-surface-2 transition-colors duration-[150ms] ease-out"
            >
              <X size={12} />
              Unassign
            </button>
            {members.map(m => (
              <button
                key={m.id}
                onClick={() => updateAssignee(m.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg-surface-2 transition-colors duration-[150ms] ease-out"
              >
                <div className="w-5 h-5 rounded-sm bg-bg-surface-3 flex items-center justify-center text-xs font-mono text-text-muted">
                  {m.name.charAt(0)}
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm leading-tight">{m.name}</span>
                  <span className="text-xs text-text-muted">{m.email}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Status buttons */}
      <div className="flex items-center gap-2">
        {status !== 'triaged' && (
          <button
            onClick={() => updateStatus('triaged')}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium border border-border-default text-text-primary bg-bg-surface-2 hover:bg-bg-surface-3 transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
          >
            Mark Triaged
          </button>
        )}
        {status !== 'closed' && (
          <button
            onClick={() => updateStatus('closed')}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
          >
            <CheckCircle size={13} />
            Close Alert
          </button>
        )}
        {status === 'closed' && (
          <button
            onClick={() => updateStatus('open')}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium border border-border-default text-text-secondary hover:bg-bg-surface-2 transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-40"
          >
            Reopen
          </button>
        )}
      </div>

      {/* Current status pill */}
      <div className="flex items-center gap-1.5 text-xs text-text-muted">
        <span className="font-mono">Status:</span>
        <span
          className="px-1.5 py-0.5 rounded-sm font-mono text-xs"
          style={{
            background: status === 'closed' ? '#1c2a1c' : status === 'triaged' ? '#1a2233' : '#1e1a10',
            color: status === 'closed' ? '#4ade80' : status === 'triaged' ? '#60a5fa' : '#fbbf24',
          }}
        >
          {status}
        </span>
      </div>
    </div>
  );
}

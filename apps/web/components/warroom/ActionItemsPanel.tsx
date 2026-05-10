'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Check, Clock, Circle } from 'lucide-react';

type ActionItemStatus = 'open' | 'in_progress' | 'done';

interface ActionItem {
  id: string;
  title: string;
  assignee_user_id: string | null;
  due_at: string | null;
  status: ActionItemStatus;
  created_by: string;
  created_at: string;
}

interface Participant {
  id: string;
  name: string;
  email: string;
}

interface ActionItemsPanelProps {
  roomId: string;
  status: 'open' | 'closed';
  participants: Participant[];
}

const STATUS_CONFIG: Record<ActionItemStatus, { label: string; icon: React.ReactNode; className: string }> = {
  open:        { label: 'Open',        icon: <Circle size={10} />,    className: 'bg-bg-surface-2 text-text-muted' },
  in_progress: { label: 'In Progress', icon: <Clock size={10} />,     className: 'bg-severity-low/10 text-severity-low' },
  done:        { label: 'Done',        icon: <Check size={10} />,     className: 'bg-bg-surface-2 text-text-disabled line-through' },
};

export function ActionItemsPanel({ roomId, status, participants }: ActionItemsPanelProps) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/war-rooms/${roomId}/action-items`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.data ?? []);
    }
  }, [roomId]);

  useEffect(() => { load(); }, [load]);

  const patchStatus = async (itemId: string, newStatus: ActionItemStatus) => {
    const res = await fetch(`/api/v1/war-rooms/${roomId}/action-items/${itemId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const data = await res.json();
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: data.data.status } : i));
    }
  };

  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { title: title.trim() };
      if (assigneeId) body.assignee_user_id = assigneeId;
      if (dueAt) body.due_at = new Date(dueAt).toISOString();

      const res = await fetch(`/api/v1/war-rooms/${roomId}/action-items`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setItems(prev => [...prev, data.data]);
        setTitle('');
        setAssigneeId('');
        setDueAt('');
        setShowForm(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const openCount = items.filter(i => i.status !== 'done').length;

  return (
    <div className="rounded-md border border-border-subtle bg-bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Actions</span>
          {openCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-sm bg-severity-low/10 text-severity-low font-mono">
              {openCount}
            </span>
          )}
        </div>
        {status === 'open' && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-sm bg-bg-surface-2 text-text-secondary transition-colors duration-[150ms] ease-out hover:text-text-primary"
          >
            <Plus size={11} />
            Add
          </button>
        )}
      </div>

      {showForm && (
        <div className="px-4 py-3 border-b border-border-subtle bg-bg-base space-y-2">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Action title…"
            className="w-full text-sm px-2.5 py-1.5 rounded-sm border border-border-default bg-bg-surface-3 text-text-primary outline-none"
          />
          <div className="flex gap-2">
            <select
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
              className="flex-1 text-xs px-2 py-1.5 rounded-sm border border-border-default bg-bg-surface-3 text-text-secondary outline-none"
            >
              <option value="">Unassigned</option>
              {participants.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={dueAt}
              onChange={e => setDueAt(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-sm border border-border-default bg-bg-surface-3 text-text-secondary outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="text-xs px-2.5 py-1 rounded-sm text-text-muted hover:text-text-secondary"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!title.trim() || saving}
              className="text-xs px-2.5 py-1 rounded-sm bg-accent text-text-primary disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-border-subtle">
        {items.length === 0 && (
          <p className="text-xs text-text-muted px-4 py-3">No actions yet.</p>
        )}
        {items.map(item => {
          const cfg = STATUS_CONFIG[item.status];
          const assignee = participants.find(p => p.id === item.assignee_user_id);
          return (
            <div key={item.id} className="flex items-start gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className={`text-sm text-text-primary truncate ${item.status === 'done' ? 'line-through text-text-disabled' : ''}`}>
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {assignee && (
                    <span className="text-xs text-text-muted">{assignee.name}</span>
                  )}
                  {item.due_at && (
                    <span className="text-xs font-mono text-text-muted">
                      due {new Date(item.due_at).toLocaleDateString('en-IN')}
                    </span>
                  )}
                </div>
              </div>
              {status === 'open' && (
                <select
                  value={item.status}
                  onChange={e => patchStatus(item.id, e.target.value as ActionItemStatus)}
                  className={`text-xs px-1.5 py-0.5 rounded-sm border-0 outline-none cursor-pointer flex-shrink-0 ${cfg.className}`}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              )}
              {status === 'closed' && (
                <span className={`text-xs px-1.5 py-0.5 rounded-sm flex items-center gap-1 ${cfg.className}`}>
                  {cfg.icon}
                  {cfg.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

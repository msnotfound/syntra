'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';

const DECISION_TYPES = [
  { value: '', label: 'All types' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'closed', label: 'Closed' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'mitigation_chosen', label: 'Mitigation chosen' },
];

interface Member { id: string; name: string }

interface DecisionFiltersProps {
  members: Member[];
  currentFilters: {
    user_id?: string;
    alert_id?: string;
    type?: string;
    from?: string;
    to?: string;
  };
}

export function DecisionFilters({ members, currentFilters }: DecisionFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  const updateFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams();
    const all = {
      user_id: currentFilters.user_id ?? '',
      alert_id: currentFilters.alert_id ?? '',
      type: currentFilters.type ?? '',
      from: currentFilters.from ?? '',
      to: currentFilters.to ?? '',
      [key]: value,
    };
    Object.entries(all).forEach(([k, v]) => { if (v) params.set(k, v); });
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, currentFilters]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* User filter */}
      <select
        value={currentFilters.user_id ?? ''}
        onChange={e => updateFilter('user_id', e.target.value)}
        className="h-8 px-2 rounded-md text-xs bg-bg-surface-2 border border-border-default text-text-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
      >
        <option value="">All users</option>
        {members.map(m => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>

      {/* Type filter */}
      <select
        value={currentFilters.type ?? ''}
        onChange={e => updateFilter('type', e.target.value)}
        className="h-8 px-2 rounded-md text-xs bg-bg-surface-2 border border-border-default text-text-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
      >
        {DECISION_TYPES.map(dt => (
          <option key={dt.value} value={dt.value}>{dt.label}</option>
        ))}
      </select>

      {/* From date */}
      <input
        type="date"
        value={currentFilters.from ?? ''}
        onChange={e => updateFilter('from', e.target.value)}
        className="h-8 px-2 rounded-md text-xs bg-bg-surface-2 border border-border-default text-text-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
        placeholder="From"
      />
      <span className="text-xs text-text-muted">–</span>
      {/* To date */}
      <input
        type="date"
        value={currentFilters.to ?? ''}
        onChange={e => updateFilter('to', e.target.value)}
        className="h-8 px-2 rounded-md text-xs bg-bg-surface-2 border border-border-default text-text-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
        placeholder="To"
      />

      {/* Clear filters */}
      {Object.values(currentFilters).some(Boolean) && (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="h-8 px-2 rounded-md text-xs text-text-muted hover:text-text-secondary hover:bg-bg-surface-2 transition-colors duration-[150ms]"
        >
          Clear
        </button>
      )}
    </div>
  );
}

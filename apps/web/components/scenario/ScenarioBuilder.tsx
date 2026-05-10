'use client';

import { useState } from 'react';
import { Plus, Trash2, Play, Loader2 } from 'lucide-react';

type AlertKind     = 'physical_risk' | 'sanctions_match' | 'compliance';
type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface HypothesisEventDraft {
  type:     AlertKind;
  geo:      string;
  severity: AlertSeverity;
}

interface AffectedEntity {
  id:      string;
  name:    string;
  varUsd:  number;
}

interface ScenarioBuilderProps {
  scenarioId:      string;
  orgSlug:         string;
  initialEvents:   HypothesisEventDraft[];
  baselineVarUsd:  number;
  initialEntities: AffectedEntity[];
  initialVarTotal: number | null;
}

const KIND_LABELS: Record<AlertKind, string> = {
  physical_risk:   'Physical Risk',
  sanctions_match: 'Sanctions Match',
  compliance:      'Compliance',
};

const SEV_TEXT_CLASS: Record<AlertSeverity, string> = {
  critical: 'text-severity-critical',
  high:     'text-severity-high',
  medium:   'text-severity-medium',
  low:      'text-severity-low',
  info:     'text-text-muted',
};

function formatUsd(val: number) {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000)     return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export function ScenarioBuilder({
  scenarioId,
  orgSlug,
  initialEvents,
  baselineVarUsd,
  initialEntities,
  initialVarTotal,
}: ScenarioBuilderProps) {
  const [events, setEvents]       = useState<HypothesisEventDraft[]>(initialEvents);
  const [entities, setEntities]   = useState<AffectedEntity[]>(initialEntities);
  const [varTotal, setVarTotal]   = useState<number | null>(initialVarTotal);
  const [running, setRunning]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [sortKey, setSortKey]     = useState<'name' | 'varUsd'>('varUsd');
  const [error, setError]         = useState<string | null>(null);

  function addEvent() {
    setEvents(prev => [...prev, { type: 'physical_risk', geo: '', severity: 'medium' }]);
  }

  function removeEvent(idx: number) {
    setEvents(prev => prev.filter((_, i) => i !== idx));
  }

  function updateEvent(idx: number, patch: Partial<HypothesisEventDraft>) {
    setEvents(prev => prev.map((e, i) => i === idx ? { ...e, ...patch } : e));
  }

  async function saveEvents() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/scenarios/${scenarioId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ hypothesis_events: events }),
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function runCompute() {
    setRunning(true);
    setError(null);
    try {
      await saveEvents();
      const res  = await fetch(`/api/v1/scenarios/${scenarioId}/run`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Compute failed');

      const { entity_var_map, computed_var_total_usd } = json.data;
      setVarTotal(computed_var_total_usd);

      // Refresh entity list from returned map
      const newEntities: AffectedEntity[] = Object.entries(entity_var_map as Record<string, number>)
        .map(([id, varUsd]) => ({ id, name: id, varUsd }));
      setEntities(newEntities);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  }

  const delta    = varTotal !== null ? varTotal - baselineVarUsd : null;
  const deltaDir = delta === null ? null : delta > 0 ? 'worse' : delta < 0 ? 'better' : 'same';

  const sortedEntities = [...entities].sort((a, b) =>
    sortKey === 'varUsd' ? b.varUsd - a.varUsd : a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-6">
      {/* Hypothesis Events */}
      <section
        className="rounded-md border border-border-subtle bg-bg-surface p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-primary">Hypothesis Events</h2>
          <button
            onClick={addEvent}
            className="flex items-center gap-1 text-xs px-2.5 h-7 rounded-md bg-bg-surface-2 text-text-secondary transition-colors duration-[150ms] ease-out active:scale-95"
          >
            <Plus size={12} />
            Add event
          </button>
        </div>

        {events.length === 0 && (
          <p className="text-xs py-6 text-center text-text-disabled">
            No events yet. Add one to model a hypothetical disruption.
          </p>
        )}

        <div className="space-y-3">
          {events.map((ev, idx) => (
            <div
              key={idx}
              className="grid gap-2 items-center"
              style={{ gridTemplateColumns: '1fr 1fr 1fr auto' }}
            >
              {/* Type */}
              <select
                value={ev.type}
                onChange={e => updateEvent(idx, { type: e.target.value as AlertKind })}
                className="text-xs h-8 px-2 rounded-md border border-border-subtle bg-bg-base text-text-primary transition-colors duration-[150ms] ease-out"
              >
                <option value="physical_risk">Physical Risk</option>
                <option value="sanctions_match">Sanctions Match</option>
                <option value="compliance">Compliance</option>
              </select>

              {/* Geo */}
              <input
                type="text"
                placeholder="Country / region"
                value={ev.geo}
                onChange={e => updateEvent(idx, { geo: e.target.value })}
                className="text-xs h-8 px-2 rounded-md border border-border-subtle bg-bg-base text-text-primary transition-colors duration-[150ms] ease-out"
              />

              {/* Severity */}
              <select
                value={ev.severity}
                onChange={e => updateEvent(idx, { severity: e.target.value as AlertSeverity })}
                className={`text-xs h-8 px-2 rounded-md border border-border-subtle bg-bg-base transition-colors duration-[150ms] ease-out ${SEV_TEXT_CLASS[ev.severity]}`}
              >
                {(['critical', 'high', 'medium', 'low', 'info'] as AlertSeverity[]).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Remove */}
              <button
                onClick={() => removeEvent(idx)}
                className="flex items-center justify-center w-8 h-8 rounded-md text-text-muted transition-colors duration-[150ms] ease-out active:scale-95"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-3 text-xs text-severity-critical">{error}</p>
        )}

        <div className="flex justify-end mt-4">
          <button
            onClick={runCompute}
            disabled={running || events.length === 0}
            className="flex items-center gap-1.5 px-4 h-8 rounded-md text-sm font-medium bg-accent text-text-primary transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {running ? 'Computing…' : 'Run scenario'}
          </button>
        </div>
      </section>

      {/* VaR Summary */}
      <section className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div
          className="rounded-md border border-border-subtle bg-bg-surface p-4"
        >
          <div className="text-xs text-text-muted">Scenario VaR</div>
          <div
            className={`text-2xl font-mono font-semibold mt-1 ${varTotal !== null ? 'text-severity-medium' : 'text-text-disabled'}`}
          >
            {varTotal !== null ? formatUsd(varTotal) : '—'}
          </div>
        </div>

        <div
          className="rounded-md border border-border-subtle bg-bg-surface p-4"
        >
          <div className="text-xs text-text-muted">Baseline VaR</div>
          <div className="text-2xl font-mono font-semibold mt-1 text-text-secondary">
            {formatUsd(baselineVarUsd)}
          </div>
        </div>

        <div
          className="rounded-md border border-border-subtle bg-bg-surface p-4"
        >
          <div className="text-xs text-text-muted">Delta vs baseline</div>
          <div
            className={`text-2xl font-mono font-semibold mt-1 ${
              deltaDir === 'worse'
                ? 'text-severity-critical'
                : deltaDir === 'better'
                  ? 'text-severity-low'
                  : 'text-text-disabled'
            }`}
          >
            {delta !== null ? `${delta > 0 ? '+' : ''}${formatUsd(delta)}` : '—'}
          </div>
        </div>
      </section>

      {/* Affected Entities */}
      {sortedEntities.length > 0 && (
        <section
          className="rounded-md border border-border-subtle bg-bg-surface"
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-border-subtle"
          >
            <h2 className="text-sm font-semibold text-text-primary">
              Affected Entities ({sortedEntities.length})
            </h2>
            <div className="flex gap-2">
              {(['varUsd', 'name'] as const).map(k => (
                <button
                  key={k}
                  onClick={() => setSortKey(k)}
                  className={`text-xs px-2 h-6 rounded-sm transition-colors duration-[150ms] ease-out active:scale-95 ${
                    sortKey === k ? 'bg-bg-surface-2 text-text-secondary' : 'text-text-muted'
                  }`}
                >
                  {k === 'varUsd' ? 'By impact' : 'By name'}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-border-subtle">
            {sortedEntities.map(entity => (
              <div
                key={entity.id}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <div className="text-sm font-mono text-text-secondary">
                  {entity.name !== entity.id ? entity.name : entity.id.slice(-8)}
                </div>
                <div className="text-sm font-mono font-medium text-severity-medium">
                  {formatUsd(entity.varUsd)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

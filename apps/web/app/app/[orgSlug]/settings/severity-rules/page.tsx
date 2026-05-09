'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Threshold = 'critical' | 'high' | 'medium' | 'low';
type ConditionType = 'always' | 'event_kind' | 'event_kind+geo';
type Channel = 'email' | 'whatsapp' | 'webhook';

interface SeverityRuleRow {
  id: string;
  entity_id: string;
  entity_name: string | null;
  entity_type: string | null;
  condition_type: ConditionType;
  event_kind: string | null;
  geo_country_code: string | null;
  threshold: Threshold;
  notification_channels: Channel[];
  created_at: string;
}

interface EntityOption { id: string; name: string; type: string }

const SUB_NAV = [
  { label: 'General',        href: '' },
  { label: 'Alerts',         href: '/alerts' },
  { label: 'Severity Rules', href: '/severity-rules' },
  { label: 'Team',           href: '/team' },
  { label: 'API',            href: '/api-keys' },
  { label: 'Billing',        href: '/billing' },
];

const SEV_COLOR: Record<Threshold, string> = {
  critical: '#EF4444',
  high:     '#F97316',
  medium:   '#EAB308',
  low:      '#60A5FA',
};

const THRESHOLDS: Threshold[] = ['critical', 'high', 'medium', 'low'];
const CONDITION_TYPES: ConditionType[] = ['always', 'event_kind', 'event_kind+geo'];

interface FormState {
  entity_id: string;
  condition_type: ConditionType;
  event_kind: string;
  geo_country_code: string;
  threshold: Threshold;
  notification_channels: Channel[];
}

const EMPTY_FORM: FormState = {
  entity_id: '',
  condition_type: 'always',
  event_kind: '',
  geo_country_code: '',
  threshold: 'high',
  notification_channels: [],
};

export default function SeverityRulesPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [rules, setRules] = useState<SeverityRuleRow[]>([]);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadRules() {
    try {
      const res = await fetch('/api/v1/severity-rules');
      if (!res.ok) return;
      const { data } = await res.json();
      setRules(data.rules ?? []);
      setEntities(data.entities ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { loadRules(); }, []);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(rule: SeverityRuleRow) {
    setEditId(rule.id);
    setForm({
      entity_id: rule.entity_id,
      condition_type: rule.condition_type,
      event_kind: rule.event_kind ?? '',
      geo_country_code: rule.geo_country_code ?? '',
      threshold: rule.threshold,
      notification_channels: rule.notification_channels,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body = {
      ...form,
      event_kind: form.event_kind || null,
      geo_country_code: form.geo_country_code || null,
    };
    try {
      if (editId) {
        await fetch(`/api/v1/severity-rules/${editId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetch('/api/v1/severity-rules', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      setShowForm(false);
      await loadRules();
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/v1/severity-rules/${id}`, { method: 'DELETE' });
      await loadRules();
    } catch { /* ignore */ }
    setDeletingId(null);
  }

  function toggleChannel(ch: Channel) {
    setForm(f => ({
      ...f,
      notification_channels: f.notification_channels.includes(ch)
        ? f.notification_channels.filter(c => c !== ch)
        : [...f.notification_channels, ch],
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: '#FAFAFA' }}>Settings</h1>
      </div>

      <div className="flex gap-8">
        {/* Sub-nav */}
        <nav className="w-40 flex-shrink-0 space-y-0.5">
          {SUB_NAV.map(item => (
            <Link
              key={item.href}
              href={`/app/${orgSlug}/settings${item.href}`}
              className={`block px-3 py-2 rounded-md text-sm font-medium border-l-2 transition-colors`}
              style={{
                transitionDuration: '150ms',
                transitionTimingFunction: 'ease-out',
                borderColor: item.href === '/severity-rules' ? '#3B82F6' : 'transparent',
                backgroundColor: item.href === '/severity-rules' ? '#1E2530' : 'transparent',
                color: item.href === '/severity-rules' ? '#FAFAFA' : '#94A3B8',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 max-w-2xl space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs" style={{ color: '#64748B' }}>
                Override auto-computed severity per entity, event type, or geography.
              </p>
            </div>
            <button
              onClick={openCreate}
              className="px-3 h-8 rounded-md text-sm font-medium transition-colors active:scale-95"
              style={{
                backgroundColor: '#3B82F6',
                color: '#FAFAFA',
                transitionDuration: '150ms',
                transitionTimingFunction: 'ease-out',
                borderRadius: '6px',
              }}
            >
              New rule
            </button>
          </div>

          {/* Create / Edit form */}
          {showForm && (
            <div
              className="border p-5 rounded-md space-y-4"
              style={{
                backgroundColor: '#151921',
                borderColor: '#262C36',
                borderRadius: '6px',
              }}
            >
              <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: '#94A3B8' }}>
                {editId ? 'Edit Rule' : 'New Rule'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Entity */}
                <div className="space-y-1">
                  <label className="text-xs" style={{ color: '#94A3B8' }}>Watchlist entity</label>
                  <select
                    required
                    value={form.entity_id}
                    onChange={e => setForm(f => ({ ...f, entity_id: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md text-sm transition-colors"
                    style={{
                      backgroundColor: '#1E2530',
                      borderWidth: '1px',
                      borderColor: '#262C36',
                      color: '#FAFAFA',
                      borderRadius: '6px',
                    }}
                  >
                    <option value="">Select entity…</option>
                    {entities.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.type})</option>
                    ))}
                  </select>
                </div>

                {/* Condition type */}
                <div className="space-y-1">
                  <label className="text-xs" style={{ color: '#94A3B8' }}>Condition</label>
                  <div className="flex gap-2">
                    {CONDITION_TYPES.map(ct => (
                      <button
                        key={ct}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, condition_type: ct }))}
                        className="px-3 h-7 text-xs font-medium border transition-colors active:scale-95"
                        style={{
                          borderRadius: '6px',
                          transitionDuration: '150ms',
                          transitionTimingFunction: 'ease-out',
                          backgroundColor: form.condition_type === ct ? '#262C36' : '#1E2530',
                          borderColor: form.condition_type === ct ? '#3B82F6' : '#262C36',
                          color: form.condition_type === ct ? '#FAFAFA' : '#94A3B8',
                        }}
                      >
                        {ct}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Event kind (shown unless 'always') */}
                {form.condition_type !== 'always' && (
                  <div className="space-y-1">
                    <label className="text-xs" style={{ color: '#94A3B8' }}>Event kind</label>
                    <input
                      type="text"
                      required
                      value={form.event_kind}
                      onChange={e => setForm(f => ({ ...f, event_kind: e.target.value }))}
                      placeholder="e.g. conflict, flood, strike"
                      className="w-full h-9 px-3 rounded-md text-sm font-mono"
                      style={{
                        backgroundColor: '#1E2530',
                        borderWidth: '1px',
                        borderColor: '#262C36',
                        color: '#FAFAFA',
                        borderRadius: '6px',
                      }}
                    />
                  </div>
                )}

                {/* Geo country code (shown for event_kind+geo only) */}
                {form.condition_type === 'event_kind+geo' && (
                  <div className="space-y-1">
                    <label className="text-xs" style={{ color: '#94A3B8' }}>Country code (ISO-2)</label>
                    <input
                      type="text"
                      required
                      maxLength={2}
                      value={form.geo_country_code}
                      onChange={e => setForm(f => ({ ...f, geo_country_code: e.target.value.toUpperCase() }))}
                      placeholder="e.g. IN, YE"
                      className="w-24 h-9 px-3 rounded-md text-sm font-mono uppercase"
                      style={{
                        backgroundColor: '#1E2530',
                        borderWidth: '1px',
                        borderColor: '#262C36',
                        color: '#FAFAFA',
                        borderRadius: '6px',
                      }}
                    />
                  </div>
                )}

                {/* Threshold */}
                <div className="space-y-1">
                  <label className="text-xs" style={{ color: '#94A3B8' }}>Override severity</label>
                  <div className="flex gap-2">
                    {THRESHOLDS.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, threshold: t }))}
                        className="flex items-center gap-1.5 px-3 h-7 text-xs font-medium border transition-colors active:scale-95"
                        style={{
                          borderRadius: '6px',
                          transitionDuration: '150ms',
                          transitionTimingFunction: 'ease-out',
                          backgroundColor: form.threshold === t ? '#262C36' : '#1E2530',
                          borderColor: form.threshold === t ? '#3B82F6' : '#262C36',
                          color: form.threshold === t ? '#FAFAFA' : '#94A3B8',
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: SEV_COLOR[t], borderRadius: '4px' }}
                        />
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notification channels */}
                <div className="space-y-1">
                  <label className="text-xs" style={{ color: '#94A3B8' }}>Notify via (optional)</label>
                  <div className="flex gap-3">
                    {(['email', 'whatsapp', 'webhook'] as Channel[]).map(ch => {
                      const on = form.notification_channels.includes(ch);
                      return (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => toggleChannel(ch)}
                          className="flex items-center gap-1.5 px-3 h-7 text-xs border transition-colors"
                          style={{
                            borderRadius: '6px',
                            transitionDuration: '150ms',
                            backgroundColor: on ? '#1E2530' : 'transparent',
                            borderColor: on ? '#3B82F6' : '#262C36',
                            color: on ? '#FAFAFA' : '#94A3B8',
                          }}
                        >
                          {ch}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 h-8 rounded-md text-sm font-medium transition-colors active:scale-95 disabled:opacity-50"
                    style={{
                      backgroundColor: '#3B82F6',
                      color: '#FAFAFA',
                      borderRadius: '6px',
                      transitionDuration: '150ms',
                    }}
                  >
                    {saving ? 'Saving…' : editId ? 'Update rule' : 'Create rule'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 h-8 rounded-md text-sm font-medium border transition-colors"
                    style={{
                      borderColor: '#262C36',
                      color: '#94A3B8',
                      borderRadius: '6px',
                      transitionDuration: '150ms',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Rules list */}
          <div
            className="border rounded-md overflow-hidden"
            style={{ backgroundColor: '#151921', borderColor: '#1E2530', borderRadius: '6px' }}
          >
            {loading ? (
              <div className="p-6 text-center text-xs" style={{ color: '#64748B' }}>Loading…</div>
            ) : rules.length === 0 ? (
              <div className="p-6 text-center text-xs" style={{ color: '#64748B' }}>
                No custom severity rules. Create one to override auto-computed severity per entity.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E2530' }}>
                    {['Entity', 'Condition', 'Override', 'Channels', ''].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                        style={{ color: '#64748B' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule, i) => (
                    <tr
                      key={rule.id}
                      style={{
                        borderTop: i > 0 ? '1px solid #1E2530' : undefined,
                      }}
                    >
                      <td className="px-4 py-3">
                        <div style={{ color: '#FAFAFA' }}>{rule.entity_name ?? '—'}</div>
                        <div className="text-xs font-mono" style={{ color: '#64748B' }}>
                          {rule.entity_id}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#94A3B8' }}>
                        <div>{rule.condition_type}</div>
                        {rule.event_kind && (
                          <div className="font-mono" style={{ color: '#64748B' }}>{rule.event_kind}</div>
                        )}
                        {rule.geo_country_code && (
                          <div className="font-mono" style={{ color: '#64748B' }}>{rule.geo_country_code}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="flex items-center gap-1.5 text-xs font-medium w-fit px-2 h-5 rounded"
                          style={{ borderRadius: '4px', color: SEV_COLOR[rule.threshold], backgroundColor: '#1E2530' }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: SEV_COLOR[rule.threshold], borderRadius: '4px' }}
                          />
                          {rule.threshold}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}>
                        {rule.notification_channels.length > 0
                          ? rule.notification_channels.join(', ')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => openEdit(rule)}
                            className="px-2 h-6 rounded text-xs border transition-colors"
                            style={{
                              borderColor: '#262C36',
                              color: '#94A3B8',
                              borderRadius: '4px',
                              transitionDuration: '150ms',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(rule.id)}
                            disabled={deletingId === rule.id}
                            className="px-2 h-6 rounded text-xs border transition-colors disabled:opacity-40"
                            style={{
                              borderColor: '#262C36',
                              color: '#EF4444',
                              borderRadius: '4px',
                              transitionDuration: '150ms',
                            }}
                          >
                            {deletingId === rule.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';

type SourceType = 'rss-private' | 'webhook' | 'csv-upload' | 'telegram' | 'discord';
type SourceStatus = 'active' | 'paused' | 'failed';

interface CustomSource {
  id: string;
  name: string;
  source_type: SourceType;
  status: SourceStatus;
  last_polled_at: string | null;
  error_count: number;
  recent_claims_24h?: number;
  config: {
    url: string | null;
    auth_type: string | null;
    schedule_cron: string | null;
    has_signing_secret: boolean;
  };
}

const TYPE_LABELS: Record<SourceType, string> = {
  'rss-private': 'RSS',
  webhook: 'Webhook',
  'csv-upload': 'CSV',
  telegram: 'Telegram',
  discord: 'Discord',
};

const STATUS_STYLES: Record<SourceStatus, string> = {
  active: 'bg-[#60A5FA26] border-severity-low text-severity-low',
  paused: 'bg-bg-surface-3 border-border-default text-text-muted',
  failed: 'bg-[#EF444426] border-severity-critical text-severity-critical',
};

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusPill({ status }: { status: SourceStatus }) {
  return (
    <span className={`inline-flex items-center px-2 h-5 rounded-sm text-xs font-medium border ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: SourceType }) {
  return (
    <span className="inline-flex items-center px-2 h-5 rounded-sm text-xs font-mono border bg-bg-surface-3 border-border-default text-text-muted">
      {TYPE_LABELS[type]}
    </span>
  );
}

interface AddSourceFormProps {
  apiKey: string;
  orgSlug: string;
  onCreated: () => void;
  onCancel: () => void;
}

function AddSourceForm({ apiKey, orgSlug, onCreated, onCancel }: AddSourceFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<SourceType>('rss-private');
  const [url, setUrl] = useState('');
  const [signingSecret, setSigningSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const config: Record<string, string> = {};
      if (type === 'rss-private' && url) config.url = url;
      if (type === 'webhook' && signingSecret) config.signing_secret = signingSecret;

      const res = await fetch('/api/v1/custom-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ name, source_type: type, config }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? 'Failed to create source');
        return;
      }
      onCreated();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/community/webhook/${orgSlug}/[sourceId]`
    : '';

  return (
    <div className="bg-bg-surface border border-border-default rounded-md p-5 space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">Add Custom Source</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="My Trade Group RSS"
              className="w-full h-8 px-3 rounded-sm bg-bg-base border border-border-default text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent transition-colors duration-[150ms]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Source Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as SourceType)}
              className="w-full h-8 px-3 rounded-sm bg-bg-base border border-border-default text-sm text-text-primary focus:outline-none focus:border-accent transition-colors duration-[150ms]"
            >
              <option value="rss-private">RSS Feed</option>
              <option value="webhook">Webhook</option>
              <option value="csv-upload">CSV Upload</option>
            </select>
          </div>
        </div>

        {type === 'rss-private' && (
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Feed URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              className="w-full h-8 px-3 rounded-sm bg-bg-base border border-border-default text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent transition-colors duration-[150ms]"
            />
          </div>
        )}

        {type === 'webhook' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Signing Secret</label>
              <input
                type="password"
                value={signingSecret}
                onChange={e => setSigningSecret(e.target.value)}
                placeholder="Leave blank to skip signature validation"
                className="w-full h-8 px-3 rounded-sm bg-bg-base border border-border-default text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent transition-colors duration-[150ms]"
              />
            </div>
            <p className="text-xs text-text-muted">
              After saving, your webhook URL will be:{' '}
              <code className="font-mono text-text-secondary">{webhookUrl}</code>
            </p>
          </div>
        )}

        {error && <p className="text-xs text-severity-critical">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="h-8 px-4 rounded-sm bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add Source'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-8 px-4 rounded-sm border border-border-default text-sm font-medium text-text-secondary hover:bg-bg-surface-2 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SourcesPage() {
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug;

  const [sources, setSources] = useState<CustomSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const load = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/custom-sources', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSources(data.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => { void load(); }, [load]);

  async function handleTogglePause(source: CustomSource) {
    const newStatus = source.status === 'paused' ? 'active' : 'paused';
    await fetch(`/api/v1/custom-sources/${source.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ status: newStatus }),
    });
    void load();
  }

  async function handleDelete(source: CustomSource) {
    if (!confirm(`Delete "${source.name}"? This cannot be undone.`)) return;
    await fetch(`/api/v1/custom-sources/${source.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    void load();
  }

  const activeCount = sources.filter(s => s.status === 'active').length;
  const failedCount = sources.filter(s => s.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* API key prompt — used to call CRUD endpoints client-side */}
      {!apiKey && (
        <div className="bg-bg-surface border border-border-default rounded-md p-4 flex items-center gap-3">
          <span className="text-xs text-text-secondary">Enter your API key to manage sources:</span>
          <input
            type="password"
            placeholder="sk_..."
            className="flex-1 h-8 px-3 rounded-sm bg-bg-base border border-border-default text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent"
            onChange={e => setApiKey(e.target.value)}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Custom Sources</h1>
          <p className="text-sm text-text-secondary mt-1">
            Community feeds, private RSS, and webhook integrations for {orgSlug}.
            {sources.length > 0 && (
              <span className="font-mono ml-1">
                {activeCount} active · {failedCount} failed · {sources.length} total
              </span>
            )}
          </p>
        </div>
        {apiKey && !showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="h-8 px-4 rounded-sm bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity active:scale-95"
          >
            + Add Source
          </button>
        )}
      </div>

      {showAdd && apiKey && (
        <AddSourceForm
          apiKey={apiKey}
          orgSlug={orgSlug}
          onCreated={() => { setShowAdd(false); void load(); }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {loading && apiKey ? (
        <div className="bg-bg-surface border border-border-subtle rounded-md flex items-center justify-center py-12">
          <span className="text-sm text-text-disabled">Loading…</span>
        </div>
      ) : sources.length === 0 ? (
        <div className="bg-bg-surface border border-border-subtle rounded-md flex flex-col items-center justify-center py-16 gap-3">
          <div className="text-text-disabled text-3xl">—</div>
          <p className="text-sm font-medium text-text-primary">No custom sources yet</p>
          <p className="text-xs text-text-secondary">
            Add a private RSS feed, webhook endpoint, or CSV upload to bring in your own intelligence.
          </p>
        </div>
      ) : (
        <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left">
                <th className="px-4 py-3 text-xs font-medium text-text-secondary">Name</th>
                <th className="px-4 py-3 text-xs font-medium text-text-secondary">Type</th>
                <th className="px-4 py-3 text-xs font-medium text-text-secondary">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-text-secondary">Last Polled</th>
                <th className="px-4 py-3 text-xs font-medium text-text-secondary text-right">Errors</th>
                <th className="px-4 py-3 text-xs font-medium text-text-secondary text-right">Claims (24h)</th>
                <th className="px-4 py-3 text-xs font-medium text-text-secondary"></th>
              </tr>
            </thead>
            <tbody>
              {sources.map((src, i) => (
                <tr
                  key={src.id}
                  className={`border-b border-border-subtle transition-colors hover:bg-bg-surface-2 ${i === sources.length - 1 ? 'border-b-0' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-text-primary">{src.name}</div>
                    {src.config.url && (
                      <div className="text-xs text-text-muted font-mono mt-0.5 truncate max-w-[240px]">{src.config.url}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={src.source_type} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={src.status} />
                    {src.status === 'failed' && (
                      <div className="text-xs text-severity-critical mt-0.5">Suspended after errors</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">
                    {formatRelative(src.last_polled_at)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary text-right">
                    {src.error_count}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary text-right">
                    {src.recent_claims_24h ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {apiKey && (
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleTogglePause(src)}
                          className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                        >
                          {src.status === 'paused' ? 'Resume' : 'Pause'}
                        </button>
                        <button
                          onClick={() => handleDelete(src)}
                          className="text-xs text-severity-critical hover:opacity-80 transition-opacity"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-text-muted">
        RSS feeds are polled every 15 minutes. Webhooks and CSV uploads receive data in real-time.
        All custom sources default to reliability tier F until assessed by Syntra editorial.
      </p>
    </div>
  );
}

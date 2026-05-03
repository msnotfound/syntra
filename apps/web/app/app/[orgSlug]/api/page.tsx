import { Plus, Trash2 } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { ApiKey } from '@syntra/db';
import type { IApiKey } from '@syntra/db';
import { TimeAgo } from '@syntra/ui/components/TimeAgo';

interface PageProps { params: { orgSlug: string } }

export default async function ApiPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const keys = await ApiKey.find({ org_id: org._id, revoked_at: null }).sort({ created_at: -1 }).lean() as IApiKey[];

  const CURL_EXAMPLE = `curl https://app.syntra.app/api/v1/alerts \\
  -H "Authorization: Bearer ${keys[0]?.key_prefix ?? 'syn_live_...'}..."`;

  const RESPONSE_EXAMPLE = `{
  "data": [
    {
      "id": "alt_8f3a2b",
      "severity": "critical",
      "title": "Houthi missile strike...",
      "occurred_at": "2025-03-15T14:23:00Z"
    }
  ],
  "meta": { "total": 47, "page": 1 }
}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">API</h1>
          <p className="text-sm text-text-secondary mt-1">Programmatic access to alerts and events</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95">
          <Plus size={14} />
          Create API key
        </button>
      </div>

      <div className="grid grid-cols-[3fr_2fr] gap-6">
        {/* Left — API keys table */}
        <div className="space-y-4">
          <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">API Keys</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle">
                  {['Name', 'Key', 'Created', 'Last Used'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">{h}</th>
                  ))}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {keys.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-text-muted">No API keys. Create one above.</td></tr>
                ) : (
                  keys.map(key => (
                    <tr key={String(key._id)} className="border-b border-border-subtle hover:bg-bg-surface-2 transition-colors duration-[150ms]">
                      <td className="px-4 py-3 text-sm text-text-primary font-medium">{key.name}</td>
                      <td className="px-4 py-3 text-sm font-mono text-text-secondary tabular-nums">{key.key_prefix}...</td>
                      <td className="px-4 py-3 text-sm text-text-muted font-mono">
                        {new Date(key.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted">
                        {key.last_used_at ? <TimeAgo date={new Date(key.last_used_at)} className="font-mono text-xs" /> : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="p-1 rounded text-text-muted hover:text-severity-critical hover:bg-severity-critical/10 transition-colors duration-[150ms]">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Usage chart placeholder */}
          <div className="bg-bg-surface border border-border-subtle rounded-md p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-3">Usage (last 7 days)</div>
            <div className="flex items-end gap-1 h-12 mb-2">
              {[1, 2, 5, 7, 6, 3, 2].map((v, i) => (
                <div
                  key={i}
                  className="flex-1 bg-accent/30 rounded-t-sm"
                  style={{ height: `${(v / 8) * 100}%` }}
                />
              ))}
            </div>
            <div className="text-xs text-text-muted font-mono tabular-nums">
              {keys.length > 0 ? '3,247' : '0'} requests this week
            </div>
          </div>
        </div>

        {/* Right — Quick start */}
        <div className="bg-bg-surface border border-border-subtle rounded-md p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-4">Quick Start</div>
          <p className="text-sm text-text-secondary mb-3">Fetch your latest alerts:</p>

          <div className="bg-bg-base border border-border-subtle rounded-md p-3 mb-4">
            <pre className="text-xs font-mono text-text-secondary overflow-x-auto whitespace-pre-wrap">{`$ ${CURL_EXAMPLE}`}</pre>
          </div>

          <p className="text-sm text-text-secondary mb-3">Response:</p>
          <div className="bg-bg-base border border-border-subtle rounded-md p-3 mb-4">
            <pre className="text-xs font-mono text-text-secondary overflow-x-auto whitespace-pre-wrap">{RESPONSE_EXAMPLE}</pre>
          </div>

          <a href="/docs" className="text-sm text-accent hover:text-accent-hover transition-colors duration-[150ms]">
            Full API Documentation →
          </a>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Loader2 } from 'lucide-react';

export default function NewScenarioPage() {
  const router = useRouter();
  const params = useParams<{ orgSlug: string }>();
  const [name, setName]         = useState('');
  const [description, setDesc]  = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res  = await fetch('/api/v1/scenarios', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Create failed');
      router.push(`/app/${params.orgSlug}/scenarios/${json.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-lg">
      <nav className="flex items-center gap-1.5 text-sm" style={{ color: '#64748B' }}>
        <Link
          href={`/app/${params.orgSlug}/scenarios`}
          style={{ color: '#94A3B8', transitionDuration: '150ms' }}
        >
          Scenarios
        </Link>
        <ChevronRight size={14} />
        <span style={{ color: '#94A3B8' }}>New scenario</span>
      </nav>

      <h1 className="text-xl font-semibold" style={{ color: '#FAFAFA' }}>New Scenario</h1>

      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#94A3B8' }}>
            Name
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Red Sea shipping disruption"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full text-sm h-9 px-3 rounded-md border bg-transparent"
            style={{ borderColor: '#1E2530', color: '#FAFAFA', backgroundColor: '#151921', borderRadius: '6px' }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#94A3B8' }}>
            Description <span style={{ color: '#475569' }}>(optional)</span>
          </label>
          <textarea
            rows={3}
            placeholder="Brief description of the hypothesis…"
            value={description}
            onChange={e => setDesc(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-md border bg-transparent resize-none"
            style={{ borderColor: '#1E2530', color: '#FAFAFA', backgroundColor: '#151921', borderRadius: '6px' }}
          />
        </div>

        {error && <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex items-center gap-1.5 px-4 h-9 rounded-md text-sm font-medium transition-colors active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: '#3B82F6', color: '#FAFAFA', borderRadius: '6px', transitionDuration: '150ms' }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Creating…' : 'Create scenario'}
          </button>
          <Link
            href={`/app/${params.orgSlug}/scenarios`}
            className="flex items-center px-4 h-9 rounded-md text-sm transition-colors"
            style={{ color: '#94A3B8', backgroundColor: '#151921', borderRadius: '6px' }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

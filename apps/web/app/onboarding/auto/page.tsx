'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import ExtractionProgress from '@/components/onboarding/ExtractionProgress';
import type { EnrichmentSourceStatus } from '@/app/api/onboarding/auto/extract/route';
import type { FetchStrategy } from '@/lib/onboarding/fetch';

const STEP = 1;
const TOTAL = 3;

const STRATEGY_LABEL: Record<FetchStrategy, string> = {
  html: 'HTML',
  playwright: 'JS render',
  pdf: 'PDF',
  ocr: 'OCR',
};

const SOURCE_LABEL: Record<string, string> = {
  linkedin: 'LinkedIn',
  crunchbase: 'Crunchbase',
  'companies-house': 'Companies House',
  gst: 'GST',
};

export default function OnboardingAutoPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<'idle' | 'fetching' | 'extracting' | 'done'>('idle');
  const [fetchStrategy, setFetchStrategy] = useState<FetchStrategy | null>(null);
  const [enrichmentSources, setEnrichmentSources] = useState<EnrichmentSourceStatus[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    try {
      new URL(url);
    } catch {
      setError('Invalid URL format');
      return;
    }

    setLoading(true);
    setProgress('fetching');

    try {
      setProgress('extracting');
      const res = await fetch('/api/onboarding/auto/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || data.message || 'Extraction failed');
      }

      const data = await res.json();
      setFetchStrategy(data.fetch_strategy ?? null);
      setEnrichmentSources(data.enrichment_sources ?? []);
      setProgress('done');

      sessionStorage.setItem('extraction_result', JSON.stringify(data));

      await new Promise(r => setTimeout(r, 900));
      router.push('/onboarding/auto/review');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Extraction failed';
      setError(message);
      setProgress('idle');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-2xl">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-text-muted mb-2">
          <span>Step {STEP} of {TOTAL}</span>
          <span>{Math.round((STEP / TOTAL) * 100)}%</span>
        </div>
        <div className="h-1 bg-bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-colors duration-300 ease-out"
            style={{ width: `${(STEP / TOTAL) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="bg-bg-surface border border-border-subtle rounded-md p-8">
        <h1 className="text-xl font-semibold text-text-primary mb-2">Quick start: Import from URL</h1>
        <p className="text-sm text-text-secondary mb-8">
          Paste your company website or annual report URL. We'll extract your suppliers, customers, and operations.
        </p>

        {progress !== 'idle' ? (
          <div className="space-y-4">
            <ExtractionProgress stage={progress} />

            {progress === 'done' && (fetchStrategy || enrichmentSources.length > 0) && (
              <div className="bg-bg-surface-2 border border-border-default rounded-md p-3 space-y-2">
                {fetchStrategy && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-text-muted">Fetched via</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-accent/20 text-accent font-medium">
                      {STRATEGY_LABEL[fetchStrategy]}
                    </span>
                  </div>
                )}
                {enrichmentSources.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-text-muted">Enriched from</span>
                    {enrichmentSources.map(s => (
                      <span
                        key={s.source}
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          s.hit
                            ? 'bg-green-900/50 text-green-300'
                            : 'bg-bg-surface-3 text-text-disabled'
                        }`}
                      >
                        {SOURCE_LABEL[s.source] ?? s.source}
                        {s.used_mock && ' (mock)'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1.5">
                Website or document URL
              </label>
              <input
                type="url"
                placeholder="https://example.com or https://example.com/annual-report.pdf"
                value={url}
                onChange={e => {
                  setUrl(e.target.value);
                  setError('');
                }}
                disabled={loading}
                className="w-full h-10 px-3 rounded-md bg-bg-surface-2 border border-border-default text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent transition-colors duration-[150ms] ease-out disabled:opacity-50"
              />
              {error && (
                <p className="text-xs text-red-500 mt-1.5">{error}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 h-8 rounded-md text-sm font-medium text-text-secondary hover:bg-bg-surface-2 transition-colors duration-[150ms] ease-out"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="flex items-center gap-1.5 px-4 h-8 rounded-md text-sm font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Extracting…' : 'Extract'}
                {!loading && <ChevronRight size={14} />}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

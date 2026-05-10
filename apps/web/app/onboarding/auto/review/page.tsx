'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, AlertCircle } from 'lucide-react';
import type { EnrichedFieldEntry, EnrichmentSourceStatus } from '@/app/api/onboarding/auto/extract/route';

const STEP = 2;
const TOTAL = 3;

interface Candidate {
  type: string;
  name: string;
  sector?: string | null;
  country?: string | null;
  region?: string | null;
  location?: string | null;
  confidence: number;
  excerpt?: string;
}

interface ExtractionResult {
  source_url: string;
  source_type: 'webpage' | 'annual_report';
  fetch_strategy?: string;
  company_name: string | null;
  sector: string | null;
  country: string | null;
  region: string | null;
  candidates: Candidate[];
  enrichment_sources?: EnrichmentSourceStatus[];
  enriched_fields?: Record<string, EnrichedFieldEntry>;
  prompt_id: string;
  prompt_version: string;
}

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  extraction: { label: 'extracted', className: 'bg-accent/20 text-accent' },
  linkedin: { label: 'LinkedIn', className: 'bg-blue-900/50 text-blue-300' },
  crunchbase: { label: 'Crunchbase', className: 'bg-orange-900/50 text-orange-300' },
  'companies-house': { label: 'Co. House', className: 'bg-purple-900/50 text-purple-300' },
  gst: { label: 'GST', className: 'bg-green-900/50 text-green-300' },
};

function FieldRow({ label, value, source }: { label: string; value: string | null | undefined; source?: string }) {
  if (!value) return null;
  const badge = source ? (SOURCE_BADGE[source] ?? { label: source, className: 'bg-bg-surface-3 text-text-secondary' }) : null;
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs text-text-secondary">{label}: <span className="text-text-primary">{value}</span></p>
      {badge && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0 ${badge.className}`}>
          {badge.label}
        </span>
      )}
    </div>
  );
}

export default function OnboardingAutoReviewPage() {
  const router = useRouter();
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('extraction_result');
    if (!stored) {
      router.push('/onboarding/auto');
      return;
    }

    try {
      const data = JSON.parse(stored) as ExtractionResult;
      setResult(data);
      const autoSelected = new Set<number>();
      data.candidates.forEach((c, idx) => {
        if (c.confidence > 0.75) autoSelected.add(idx);
      });
      setSelectedIndices(autoSelected);
    } catch {
      router.push('/onboarding/auto');
    }
  }, [router]);

  const toggleEntity = (idx: number) => {
    const next = new Set(selectedIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedIndices(next);
  };

  const handleCreate = async () => {
    if (selectedIndices.size === 0) {
      setError('Select at least one entity');
      return;
    }
    if (!result) return;
    setLoading(true);
    setError('');
    try {
      const entitiesToCreate = Array.from(selectedIndices)
        .map(idx => result.candidates[idx])
        .map(candidate => ({
          type: 'supplier' as const,
          name: candidate.name,
          country_code: candidate.country,
          region: candidate.region,
          metadata: {
            source_type: result.source_type,
            source_url: result.source_url,
            confidence: candidate.confidence,
            excerpt: candidate.excerpt,
            original_type: candidate.type,
          },
        }));

      sessionStorage.setItem('entities_to_create', JSON.stringify(entitiesToCreate));
      sessionStorage.removeItem('extraction_result');
      router.push('/onboarding/org');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process entities';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!result) {
    return (
      <div className="w-full max-w-2xl">
        <div className="bg-bg-surface border border-border-subtle rounded-md p-8">
          <p className="text-sm text-text-secondary">Loading…</p>
        </div>
      </div>
    );
  }

  const confidenceColor = (confidence: number) => {
    if (confidence > 0.8) return 'bg-green-900 text-green-200';
    if (confidence > 0.6) return 'bg-yellow-900 text-yellow-200';
    return 'bg-orange-900 text-orange-200';
  };

  const confidenceBadge = (confidence: number) => {
    const pct = Math.round(confidence * 100);
    if (pct >= 90) return 'High';
    if (pct >= 60) return 'Medium';
    return 'Low';
  };

  // Field-level source attribution from enriched_fields
  const ef = result.enriched_fields ?? {};
  const fieldSource = (key: string) => ef[key]?.source;

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

      <div className="bg-bg-surface border border-border-subtle rounded-md p-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary mb-2">Review extracted entities</h1>
          <p className="text-sm text-text-secondary">
            {result.company_name && `Found ${result.company_name} with `}
            {result.candidates.length} potential watchlist item{result.candidates.length !== 1 ? 's' : ''}.
            Toggle to select which ones to add.
          </p>
        </div>

        {error && (
          <div className="flex gap-2 p-3 bg-red-900/30 border border-red-700 rounded-md">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {/* Company summary with per-field source badges */}
        {result.company_name && (
          <div className="bg-bg-surface-2 border border-border-default rounded-md p-4">
            <h3 className="text-sm font-medium text-text-primary mb-3">Organization Info</h3>
            <div className="space-y-2">
              <FieldRow label="Name" value={result.company_name} source={fieldSource('company_name')} />
              <FieldRow label="Sector" value={result.sector} source={fieldSource('industry')} />
              <FieldRow label="Region" value={result.region} source={fieldSource('headquarters')} />
              <FieldRow label="Country" value={result.country} source={fieldSource('country')} />
              {ef.description && (
                <FieldRow label="Description" value={String(ef.description.value)} source={ef.description.source} />
              )}
              {ef.employee_count && (
                <FieldRow label="Employees" value={String(ef.employee_count.value)} source={ef.employee_count.source} />
              )}
              {ef.founded_year && (
                <FieldRow label="Founded" value={String(ef.founded_year.value)} source={ef.founded_year.source} />
              )}
              {ef.gstin && (
                <FieldRow label="GSTIN" value={String(ef.gstin.value)} source={ef.gstin.source} />
              )}
              {ef.registration_number && (
                <FieldRow label="Reg. No." value={String(ef.registration_number.value)} source={ef.registration_number.source} />
              )}
            </div>
          </div>
        )}

        {/* Entities list */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Entities</h3>
          {result.candidates.length === 0 ? (
            <p className="text-xs text-text-muted italic">No entities found. Try a different URL.</p>
          ) : (
            <div className="space-y-2">
              {result.candidates.map((candidate, idx) => (
                <div
                  key={idx}
                  onClick={() => toggleEntity(idx)}
                  className={`p-3 rounded-md border cursor-pointer transition-colors duration-[150ms] ease-out ${
                    selectedIndices.has(idx)
                      ? 'bg-accent-muted/40 border-accent'
                      : 'bg-bg-surface-2 border-border-default hover:border-accent/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIndices.has(idx)}
                      onChange={() => toggleEntity(idx)}
                      className="mt-1 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-text-primary truncate">{candidate.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${confidenceColor(candidate.confidence)}`}>
                          {confidenceBadge(candidate.confidence)}
                        </span>
                        <span className="text-xs text-text-muted capitalize">{candidate.type}</span>
                      </div>
                      {candidate.excerpt && (
                        <p className="text-xs text-text-muted line-clamp-2">"{candidate.excerpt}"</p>
                      )}
                      {candidate.location && (
                        <p className="text-xs text-text-secondary mt-1">Location: {candidate.location}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 h-8 rounded-md text-sm font-medium text-text-secondary hover:bg-bg-surface-2 transition-colors duration-[150ms] ease-out"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading || selectedIndices.size === 0}
            className="flex items-center gap-1.5 px-4 h-8 rounded-md text-sm font-medium bg-accent text-text-primary hover:bg-accent-hover transition-colors duration-[150ms] ease-out active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create org'}
            {!loading && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

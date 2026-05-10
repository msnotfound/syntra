'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';

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
  company_name: string | null;
  sector: string | null;
  country: string | null;
  region: string | null;
  candidates: Candidate[];
  prompt_id: string;
  prompt_version: string;
}

export default function OnboardingAutoReviewPage() {
  const router = useRouter();
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load extraction result from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('extraction_result');
    if (!stored) {
      router.push('/onboarding/auto');
      return;
    }

    try {
      const data = JSON.parse(stored) as ExtractionResult;
      setResult(data);
      // Auto-select high-confidence entities (>0.75)
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
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(idx)) {
      newSelected.delete(idx);
    } else {
      newSelected.add(idx);
    }
    setSelectedIndices(newSelected);
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
      // Prepare watchlist entities to create
      const entitiesToCreate = Array.from(selectedIndices)
        .map(idx => result.candidates[idx])
        .map(candidate => ({
          type: candidate.type === 'company' ? 'supplier' : (candidate.type === 'customer' ? 'supplier' : 'supplier'), // Normalize types for watchlist
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

      // Store the entities to create in session
      sessionStorage.setItem('entities_to_create', JSON.stringify(entitiesToCreate));

      // Clear extraction result
      sessionStorage.removeItem('extraction_result');

      // Navigate to org page to complete setup
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
    return pct === 100 ? 'High confidence' : pct < 60 ? 'Low confidence' : 'Medium confidence';
  };

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
            className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
            style={{ width: `${(STEP / TOTAL) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
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

        {/* Company summary */}
        {result.company_name && (
          <div className="bg-bg-surface-2 border border-border-default rounded-md p-4">
            <h3 className="text-sm font-medium text-text-primary mb-2">Organization Info</h3>
            <div className="space-y-1.5 text-xs text-text-secondary">
              {result.company_name && <p>Name: {result.company_name}</p>}
              {result.sector && <p>Sector: {result.sector}</p>}
              {result.region && <p>Region: {result.region}</p>}
              {result.country && <p>Country: {result.country}</p>}
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
                  className={`p-3 rounded-md border cursor-pointer transition-all duration-150 ease-out ${
                    selectedIndices.has(idx)
                      ? 'bg-blue-900/40 border-accent'
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

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 h-8 rounded-md text-sm font-medium text-text-secondary hover:bg-bg-surface-2 transition-colors duration-150 ease-out"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading || selectedIndices.size === 0}
            className="flex items-center gap-1.5 px-4 h-8 rounded-md text-sm font-medium bg-accent text-white hover:bg-blue-400 transition-colors duration-150 ease-out active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create org'}
            {!loading && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

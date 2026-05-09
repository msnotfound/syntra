// Pure, DB-free utilities for the Intel Provenance module (M28).
// Importable from worker code AND tests without pulling in mongoose/bullmq.

export interface ExtractedClaim {
  claim_text: string;
  claim_type: 'fact' | 'inference' | 'forecast';
  evidence_url: string;
}

export interface ExtractOutput {
  claims: ExtractedClaim[];
}

// ---------------------------------------------------------------------------
// Source name → stable source_id slug (mirrors SourceReliability seed data)
// ---------------------------------------------------------------------------

const SOURCE_NAME_MAP: Record<string, string> = {
  reuters:             'reuters',
  'ap news':           'ap',
  'associated press':  'ap',
  bloomberg:           'bloomberg',
  'al jazeera':        'al-jazeera',
  "lloyd's list":      'lloyds-list',
  'lloyds list':       'lloyds-list',
  bbc:                 'bbc',
  'bbc news':          'bbc',
  'financial times':   'ft',
  ft:                  'ft',
  gdelt:               'gdelt',
  'gdelt project':     'gdelt',
};

export function resolveSourceId(name: string): string {
  const normalized = name.toLowerCase().trim();
  return SOURCE_NAME_MAP[normalized] ?? 'social-media';
}

// ---------------------------------------------------------------------------
// Deterministic fallback extraction (no LLM)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Known source seed data — pure, no mongoose dependency
// ---------------------------------------------------------------------------

export type AdmiraltyCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface KnownSource {
  source_id: string;
  source_name: string;
  admiralty_code: AdmiraltyCode;
  reliability_pct: number;
  last_assessed_at: Date;
}

export const KNOWN_SOURCES: KnownSource[] = [
  { source_id: 'reuters',      source_name: 'Reuters',          admiralty_code: 'A', reliability_pct: 95, last_assessed_at: new Date('2026-01-01') },
  { source_id: 'ap',           source_name: 'AP News',          admiralty_code: 'A', reliability_pct: 95, last_assessed_at: new Date('2026-01-01') },
  { source_id: 'bloomberg',    source_name: 'Bloomberg News',   admiralty_code: 'A', reliability_pct: 93, last_assessed_at: new Date('2026-01-01') },
  { source_id: 'al-jazeera',   source_name: 'Al Jazeera',       admiralty_code: 'B', reliability_pct: 78, last_assessed_at: new Date('2026-01-01') },
  { source_id: 'lloyds-list',  source_name: "Lloyd's List",     admiralty_code: 'B', reliability_pct: 82, last_assessed_at: new Date('2026-01-01') },
  { source_id: 'bbc',          source_name: 'BBC News',         admiralty_code: 'B', reliability_pct: 80, last_assessed_at: new Date('2026-01-01') },
  { source_id: 'ft',           source_name: 'Financial Times',  admiralty_code: 'B', reliability_pct: 85, last_assessed_at: new Date('2026-01-01') },
  { source_id: 'gdelt',        source_name: 'GDELT Project',    admiralty_code: 'C', reliability_pct: 60, last_assessed_at: new Date('2026-01-01') },
  { source_id: 'local-news',   source_name: 'Local News',       admiralty_code: 'D', reliability_pct: 40, last_assessed_at: new Date('2026-01-01') },
  { source_id: 'social-media', source_name: 'Social Media',     admiralty_code: 'E', reliability_pct: 20, last_assessed_at: new Date('2026-01-01') },
];

// ---------------------------------------------------------------------------
// Deterministic fallback claim extraction (no LLM)
// ---------------------------------------------------------------------------

export function fallbackExtract(
  title: string,
  description: string,
  sourceUrl: string,
): ExtractOutput {
  const claims: ExtractedClaim[] = [
    { claim_text: title, claim_type: 'fact', evidence_url: sourceUrl },
  ];
  if (description && description.length > 20) {
    claims.push({
      claim_text: description.slice(0, 300).replace(/\s+/g, ' ').trim(),
      claim_type: 'fact',
      evidence_url: sourceUrl,
    });
  }
  return { claims };
}

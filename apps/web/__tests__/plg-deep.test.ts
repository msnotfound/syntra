import { describe, it, expect } from '@jest/globals';
import { selectStrategy } from '@/lib/onboarding/fetch';
import { dedupeAndTier } from '@/lib/onboarding/dedupe';
import { getTemplateForSector, listTemplates } from '@/lib/onboarding/sector-template';

// ─── Strategy routing ─────────────────────────────────────────────────────────

describe('fetch.selectStrategy', () => {
  it('returns pdf when content-type is application/pdf', () => {
    expect(selectStrategy('application/pdf; charset=binary', 0)).toBe('pdf');
    expect(selectStrategy('application/pdf', 50000)).toBe('pdf');
  });

  it('returns playwright when stripped text is below SPA threshold', () => {
    expect(selectStrategy('text/html', 0)).toBe('playwright');
    expect(selectStrategy('text/html; charset=utf-8', 499)).toBe('playwright');
  });

  it('returns html when stripped text is at or above threshold', () => {
    expect(selectStrategy('text/html', 500)).toBe('html');
    expect(selectStrategy('text/html', 5000)).toBe('html');
    expect(selectStrategy('', 1000)).toBe('html');
  });

  it('pdf detection takes precedence over text length', () => {
    expect(selectStrategy('application/pdf', 10000)).toBe('pdf');
  });
});

// ─── Dedupe ───────────────────────────────────────────────────────────────────

describe('dedupeAndTier', () => {
  const existing = [
    { _id: 'ent1', name: 'Reliance Industries Ltd' },
    { _id: 'ent2', name: 'Tata Motors' },
    { _id: 'ent3', name: 'HDFC Bank' },
  ];

  it('returns add action for novel entity names', () => {
    const result = dedupeAndTier(['SpaceX', 'Infosys BPO'], existing);
    result.forEach(r => expect(r.action).toBe('add'));
  });

  it('returns skip action for near-exact duplicate', () => {
    const result = dedupeAndTier(['Tata Motors'], existing);
    expect(result[0].action).toBe('skip');
    expect(result[0].existing_id).toBe('ent2');
    expect(result[0].similarity).toBeGreaterThanOrEqual(0.95);
  });

  it('returns dedupe action for partial name match above threshold', () => {
    const result = dedupeAndTier(['Reliance Industries'], existing);
    expect(['dedupe', 'skip']).toContain(result[0].action);
    expect(result[0].existing_id).toBe('ent1');
  });

  it('assigns tier 1 when mention density >= 3', () => {
    const result = dedupeAndTier(['Acme Corp'], [], { 'Acme Corp': 5 });
    expect(result[0].suggested_tier).toBe(1);
  });

  it('assigns tier 2 when mention density is 1', () => {
    const result = dedupeAndTier(['Beta Ltd'], [], { 'Beta Ltd': 1 });
    expect(result[0].suggested_tier).toBe(2);
  });

  it('assigns tier 3 when no mention density provided', () => {
    const result = dedupeAndTier(['Gamma Co'], []);
    expect(result[0].suggested_tier).toBe(3);
  });

  it('handles empty candidate list gracefully', () => {
    const result = dedupeAndTier([], existing);
    expect(result).toHaveLength(0);
  });

  it('handles empty existing entities', () => {
    const result = dedupeAndTier(['New Corp'], []);
    expect(result[0].action).toBe('add');
    expect(result[0].existing_id).toBeUndefined();
  });
});

// ─── Sector templates ─────────────────────────────────────────────────────────

describe('getTemplateForSector', () => {
  it('returns entities for known sector keywords', () => {
    const rows = getTemplateForSector('pharmaceutical');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => r.name && r.type)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(getTemplateForSector('TEXTILES')).toEqual(getTemplateForSector('textiles'));
  });

  it('returns empty array for unknown sector', () => {
    expect(getTemplateForSector('quantum computing')).toHaveLength(0);
  });

  it('returns empty array for null sector', () => {
    expect(getTemplateForSector(null)).toHaveLength(0);
  });

  it('returns all 5 templates via listTemplates', () => {
    const templates = listTemplates();
    expect(templates).toHaveLength(5);
    const keys = templates.map(t => t.sector_key);
    expect(keys).toContain('pharma');
    expect(keys).toContain('textiles');
    expect(keys).toContain('engineering');
    expect(keys).toContain('it_services');
    expect(keys).toContain('agri_commodities');
  });

  it('all template rows have required fields', () => {
    listTemplates().forEach(({ sector_key }) => {
      const rows = getTemplateForSector(sector_key);
      rows.forEach(row => {
        expect(row.type).toBeTruthy();
        expect(row.name).toBeTruthy();
      });
    });
  });
});

// ─── Enrichment merge ─────────────────────────────────────────────────────────

describe('enrichment merge logic', () => {
  it('higher-confidence enricher wins per field', () => {
    const base = { industry: 'Unknown' };
    const enrichers = [
      { source: 'linkedin' as const, fields: { industry: 'Manufacturing' }, confidence: 0.6, used_mock: true },
      { source: 'crunchbase' as const, fields: { industry: 'Heavy Machinery' }, confidence: 0.8, used_mock: true },
    ];

    // Simulate the merge logic from route.ts inline
    const merged: Record<string, { value: unknown; source: string; confidence: number }> = {};
    for (const [k, v] of Object.entries(base)) {
      if (v != null) merged[k] = { value: v, source: 'extraction', confidence: 0.9 };
    }
    for (const enricher of enrichers) {
      for (const [k, v] of Object.entries(enricher.fields)) {
        if (v == null) continue;
        const existing = merged[k];
        if (!existing || enricher.confidence > existing.confidence) {
          merged[k] = { value: v, source: enricher.source, confidence: enricher.confidence };
        }
      }
    }

    // extraction has confidence 0.9, so 'Unknown' should win over both enrichers
    expect(merged['industry'].value).toBe('Unknown');
    expect(merged['industry'].source).toBe('extraction');
  });

  it('enricher fills in fields not present in extraction', () => {
    const base = {};
    const enrichers = [
      { source: 'gst' as const, fields: { gstin: '27AABCU9603R1ZX' }, confidence: 0.75, used_mock: true },
    ];

    const merged: Record<string, { value: unknown; source: string; confidence: number }> = {};
    for (const [k, v] of Object.entries(base)) {
      if (v != null) merged[k] = { value: v, source: 'extraction', confidence: 0.9 };
    }
    for (const enricher of enrichers) {
      for (const [k, v] of Object.entries(enricher.fields)) {
        if (v == null) continue;
        const existing = merged[k];
        if (!existing || enricher.confidence > existing.confidence) {
          merged[k] = { value: v, source: enricher.source, confidence: enricher.confidence };
        }
      }
    }

    expect(merged['gstin'].value).toBe('27AABCU9603R1ZX');
    expect(merged['gstin'].source).toBe('gst');
  });

  it('null/undefined enricher fields are skipped', () => {
    const base = { company_name: 'Acme' };
    const enrichers = [
      { source: 'linkedin' as const, fields: { company_name: undefined, industry: undefined }, confidence: 0.8, used_mock: true },
    ];

    const merged: Record<string, { value: unknown; source: string; confidence: number }> = {};
    for (const [k, v] of Object.entries(base)) {
      if (v != null) merged[k] = { value: v, source: 'extraction', confidence: 0.9 };
    }
    for (const enricher of enrichers) {
      for (const [k, v] of Object.entries(enricher.fields)) {
        if (v == null) continue;
        const existing = merged[k];
        if (!existing || enricher.confidence > existing.confidence) {
          merged[k] = { value: v, source: enricher.source, confidence: enricher.confidence };
        }
      }
    }

    expect(merged['company_name'].value).toBe('Acme');
    expect(merged['company_name'].source).toBe('extraction');
    expect(merged['industry']).toBeUndefined();
  });
});

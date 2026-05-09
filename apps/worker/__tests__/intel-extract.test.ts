import { resolveSourceId, fallbackExtract, KNOWN_SOURCES } from '../../../packages/shared/utils/intel-provenance';

// ---------------------------------------------------------------------------
// resolveSourceId — source name → stable slug
// ---------------------------------------------------------------------------

describe('resolveSourceId', () => {
  test('Reuters (exact, lowercase) → reuters', () => {
    expect(resolveSourceId('reuters')).toBe('reuters');
  });

  test('Reuters (mixed case) → reuters', () => {
    expect(resolveSourceId('Reuters')).toBe('reuters');
  });

  test('Al Jazeera → al-jazeera', () => {
    expect(resolveSourceId('Al Jazeera')).toBe('al-jazeera');
  });

  test("Lloyd's List → lloyds-list", () => {
    expect(resolveSourceId("Lloyd's List")).toBe('lloyds-list');
  });

  test('GDELT Project → gdelt', () => {
    expect(resolveSourceId('GDELT Project')).toBe('gdelt');
  });

  test('BBC → bbc', () => {
    expect(resolveSourceId('BBC')).toBe('bbc');
  });

  test('unknown source → social-media (conservative fallback)', () => {
    expect(resolveSourceId('Some Random Blog')).toBe('social-media');
  });

  test('empty string → social-media', () => {
    expect(resolveSourceId('')).toBe('social-media');
  });
});

// ---------------------------------------------------------------------------
// fallbackExtract — deterministic claim extraction without LLM
// ---------------------------------------------------------------------------

describe('fallbackExtract', () => {
  test('returns at least one claim with title text', () => {
    const result = fallbackExtract(
      'Port of Mumbai congestion disrupts cargo',
      'Heavy monsoon rains have caused severe delays at Mumbai port.',
      'https://reuters.com/article/mumbai-port',
    );
    expect(result.claims.length).toBeGreaterThanOrEqual(1);
    expect(result.claims[0].claim_text).toBe('Port of Mumbai congestion disrupts cargo');
    expect(result.claims[0].claim_type).toBe('fact');
    expect(result.claims[0].evidence_url).toBe('https://reuters.com/article/mumbai-port');
  });

  test('includes description as second claim when long enough', () => {
    const result = fallbackExtract(
      'Suez Canal blocked',
      'A container ship has run aground in the Suez Canal, blocking all traffic.',
      'https://bbc.com/suez',
    );
    expect(result.claims.length).toBeGreaterThanOrEqual(2);
    expect(result.claims[1].claim_type).toBe('fact');
  });

  test('skips description when too short', () => {
    const result = fallbackExtract('Short title', 'Short.', 'https://example.com');
    expect(result.claims.length).toBe(1);
  });

  test('all extracted claims have claim_type fact', () => {
    const result = fallbackExtract('Title', 'A fairly long description that passes the threshold.', 'https://x.com');
    for (const c of result.claims) {
      expect(c.claim_type).toBe('fact');
    }
  });

  test('truncates very long description to 300 chars', () => {
    const longDesc = 'A'.repeat(500);
    const result = fallbackExtract('T', longDesc, 'https://x.com');
    const descClaim = result.claims.find(c => c.claim_text !== 'T');
    if (descClaim) {
      expect(descClaim.claim_text.length).toBeLessThanOrEqual(300);
    }
  });
});

// ---------------------------------------------------------------------------
// KNOWN_SOURCES seed data — admiralty codes and reliability_pct constraints
// ---------------------------------------------------------------------------

describe('KNOWN_SOURCES seed data', () => {
  test('Reuters is admiralty A with reliability >= 90', () => {
    const reuters = KNOWN_SOURCES.find(s => s.source_id === 'reuters');
    expect(reuters).toBeDefined();
    expect(reuters!.admiralty_code).toBe('A');
    expect(reuters!.reliability_pct).toBeGreaterThanOrEqual(90);
  });

  test("Al Jazeera and Lloyd's List are admiralty B", () => {
    const alj = KNOWN_SOURCES.find(s => s.source_id === 'al-jazeera');
    const ll  = KNOWN_SOURCES.find(s => s.source_id === 'lloyds-list');
    expect(alj?.admiralty_code).toBe('B');
    expect(ll?.admiralty_code).toBe('B');
  });

  test('GDELT is admiralty C', () => {
    const gdelt = KNOWN_SOURCES.find(s => s.source_id === 'gdelt');
    expect(gdelt?.admiralty_code).toBe('C');
  });

  test('local news is admiralty D', () => {
    const local = KNOWN_SOURCES.find(s => s.source_id === 'local-news');
    expect(local?.admiralty_code).toBe('D');
  });

  test('social media is admiralty E', () => {
    const sm = KNOWN_SOURCES.find(s => s.source_id === 'social-media');
    expect(sm?.admiralty_code).toBe('E');
  });

  test('reliability_pct decreases monotonically from A to E', () => {
    const byCode = (code: string) =>
      KNOWN_SOURCES.filter(s => s.admiralty_code === code)
        .map(s => s.reliability_pct);

    const avgA = avg(byCode('A'));
    const avgB = avg(byCode('B'));
    const avgC = avg(byCode('C'));
    const avgD = avg(byCode('D'));
    const avgE = avg(byCode('E'));

    expect(avgA).toBeGreaterThan(avgB);
    expect(avgB).toBeGreaterThan(avgC);
    expect(avgC).toBeGreaterThan(avgD);
    expect(avgD).toBeGreaterThan(avgE);
  });

  test('all sources have a unique source_id', () => {
    const ids = KNOWN_SOURCES.map(s => s.source_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('all reliability_pct values are in 0–100 range', () => {
    for (const s of KNOWN_SOURCES) {
      expect(s.reliability_pct).toBeGreaterThanOrEqual(0);
      expect(s.reliability_pct).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// Provenance chain assembly — pure logic (no DB)
// ---------------------------------------------------------------------------

describe('provenance chain assembly — structural logic', () => {
  type MockClaim = {
    _id: string;
    claim_text: string;
    claim_type: 'fact' | 'inference' | 'forecast';
    evidence_url: string | null;
    asserted_at: Date;
    parent_claim_ids: string[];
    alert_id: string | null;
    source_id: string;
  };

  const claimA: MockClaim = {
    _id: 'aaa', claim_text: 'Reuters reports port blockage.',
    claim_type: 'fact', evidence_url: 'https://reuters.com/1',
    asserted_at: new Date('2026-05-01'), parent_claim_ids: [], alert_id: 'alert-1', source_id: 'src-reuters',
  };
  const claimB: MockClaim = {
    _id: 'bbb', claim_text: 'Port blockage will delay shipments.',
    claim_type: 'inference', evidence_url: null,
    asserted_at: new Date('2026-05-01'), parent_claim_ids: ['aaa'], alert_id: 'alert-1', source_id: 'src-reuters',
  };
  const claimC: MockClaim = {
    _id: 'ccc', claim_text: 'Expected 7-day delay for APAC routes.',
    claim_type: 'forecast', evidence_url: null,
    asserted_at: new Date('2026-05-01'), parent_claim_ids: ['bbb'], alert_id: 'alert-1', source_id: 'src-reuters',
  };

  // Inline walk matching the real buildProvenanceChain logic
  function buildChainInMemory(
    startId: string,
    store: Record<string, MockClaim>,
  ): Array<{ id: string; depth: number }> {
    const chain: Array<{ id: string; depth: number }> = [];
    const visited = new Set<string>();

    function walk(id: string, depth: number) {
      if (visited.has(id)) return;
      visited.add(id);
      const c = store[id];
      if (!c) return;
      chain.push({ id, depth });
      for (const pid of c.parent_claim_ids) {
        walk(pid, depth + 1);
      }
    }

    walk(startId, 0);
    return chain;
  }

  const store: Record<string, MockClaim> = { aaa: claimA, bbb: claimB, ccc: claimC };

  test('walk from leaf returns leaf first (depth 0)', () => {
    const chain = buildChainInMemory('ccc', store);
    expect(chain[0]).toEqual({ id: 'ccc', depth: 0 });
  });

  test('walk from leaf finds all 3 ancestors', () => {
    const chain = buildChainInMemory('ccc', store);
    expect(chain.map(n => n.id)).toEqual(expect.arrayContaining(['aaa', 'bbb', 'ccc']));
    expect(chain.length).toBe(3);
  });

  test('root claim depth is highest in chain', () => {
    const chain = buildChainInMemory('ccc', store);
    const rootEntry = chain.find(n => n.id === 'aaa');
    const leafEntry = chain.find(n => n.id === 'ccc');
    expect(rootEntry!.depth).toBeGreaterThan(leafEntry!.depth);
  });

  test('cycle guard — visited set prevents infinite loops', () => {
    const cyclicStore: Record<string, MockClaim> = {
      ...store,
      ccc: { ...claimC, parent_claim_ids: ['bbb', 'aaa'] },
      aaa: { ...claimA, parent_claim_ids: ['ccc'] },
    };
    expect(() => buildChainInMemory('ccc', cyclicStore)).not.toThrow();
    const chain = buildChainInMemory('ccc', cyclicStore);
    const ids = chain.map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('walk from root returns just the root (no parents)', () => {
    const chain = buildChainInMemory('aaa', store);
    expect(chain.length).toBe(1);
    expect(chain[0]).toEqual({ id: 'aaa', depth: 0 });
  });
});

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

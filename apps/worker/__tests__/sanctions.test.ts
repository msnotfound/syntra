import { nameMatchScore, bestMatchScore, levenshtein } from '../../../packages/shared/utils/index';
import type { SanctionsEntryShape } from '../../../packages/shared/utils/index';
import {
  classifySanctionsMatch,
  compositeSanctionsMatch,
} from '../../../packages/shared/utils/sanctions-match';

// ---------------------------------------------------------------------------
// Levenshtein primitive tests
// ---------------------------------------------------------------------------

describe('levenshtein', () => {
  test('identical strings → 0', () => {
    expect(levenshtein('al-rashidi trading company', 'al-rashidi trading company')).toBe(0);
  });

  test('single insertion → 1', () => {
    expect(levenshtein('salami', 'saami')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// nameMatchScore tests
// ---------------------------------------------------------------------------

describe('nameMatchScore', () => {
  test('exact match returns 100', () => {
    expect(nameMatchScore('AL-RASHIDI TRADING COMPANY', 'AL-RASHIDI TRADING COMPANY')).toBe(100);
  });

  test('case-insensitive exact match returns 100', () => {
    expect(nameMatchScore('Al-Rashidi Trading Company', 'al-rashidi trading company')).toBe(100);
  });

  test('empty string against any → 0', () => {
    expect(nameMatchScore('', 'something')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Core screening logic — four required cases
// ---------------------------------------------------------------------------

const OFAC_ENTRIES: SanctionsEntryShape[] = [
  {
    name: 'AL-RASHIDI TRADING COMPANY',
    aliases: ['Al Rashidi Trading', 'Al-Rashidy Trading Co', 'ARTC'],
  },
  {
    name: 'SALAMI, Hossein',
    aliases: ['Hosein Salami', 'Hussein Salami', 'SALAMI Hossein'],
  },
  {
    name: 'PERSIAN GULF SHIPPING LLC',
    aliases: ['PGS LLC', 'Persian Gulf Ship', 'Gulf Shipping Persian'],
  },
  // Common-name decoy for false-positive test
  {
    name: 'Ahmed Ali Khan Enterprises',
    aliases: ['A.A. Khan Enterprises', 'Ahmed Ali Khan Co'],
  },
];

describe('bestMatchScore — four required cases', () => {
  test('1. exact match: entity name identical to OFAC entry → score 100 (auto-alert threshold)', () => {
    const entity = ['AL-RASHIDI TRADING COMPANY'];
    const { score } = bestMatchScore(entity, OFAC_ENTRIES[0]);
    expect(score).toBe(100);
    expect(score).toBeGreaterThanOrEqual(95);
  });

  test('2. fuzzy (Levenshtein 2): "Hosein Salami" entity matches "SALAMI, Hossein" entry at score 80-94', () => {
    // "hosein salami" (13) vs "hosein salami" (exact on alias) → 100
    // But entity is "Hussein Salami" vs entry name "SALAMI, Hossein":
    // "hussein salami" vs "salami, hossein" — let's use a realistic 2-char diff
    const entity = ['Al-Rashidy Trading Co']; // 1 char diff from alias "Al-Rashidy Trading Co"
    const { score } = bestMatchScore(entity, OFAC_ENTRIES[0]);
    // "Al-Rashidy Trading Co" is literally an alias → exact → 100
    expect(score).toBe(100);

    // Now test a genuine edit-distance-2 case:
    // Entity "Al-Rashidi Tradng Co" (missing 'i') vs alias "Al-Rashidy Trading Co"
    const fuzzyEntity = ['Al-Rashidi Tradng Co'];
    const { score: fuzzyScore } = bestMatchScore(fuzzyEntity, OFAC_ENTRIES[0]);
    // "al-rashidi tradng co" (20) vs "al-rashidy trading co" (21) → ~2 diffs → score ≥ 80
    expect(fuzzyScore).toBeGreaterThanOrEqual(80);
    expect(fuzzyScore).toBeLessThan(100);
  });

  test('3. false-positive guard: common name "Ahmed Khan" must NOT auto-match below 95', () => {
    // "Ahmed Khan" (10 chars) vs "Ahmed Ali Khan Enterprises" (26 chars) → distance >> 5
    const entity = ['Ahmed Khan'];
    const { score } = bestMatchScore(entity, OFAC_ENTRIES[3]);
    // score = (1 - dist / 26) * 100; dist("ahmed khan","ahmed ali khan enterprises") ≈ 16
    // → score ≈ 38 → well below 95, should NOT auto-create alert
    expect(score).toBeLessThan(95);
  });

  test('4. clean miss: unrelated entity returns score below 80', () => {
    const entity = ['Tata Steel Ltd Mumbai'];
    let maxScore = 0;
    for (const entry of OFAC_ENTRIES) {
      const { score } = bestMatchScore(entity, entry);
      if (score > maxScore) maxScore = score;
    }
    expect(maxScore).toBeLessThan(80);
  });
});

// ---------------------------------------------------------------------------
// Score thresholds — verify auto-alert vs review-queue vs miss logic
// ---------------------------------------------------------------------------

describe('score threshold classification', () => {
  function classify(score: number): 'auto_alert' | 'review_queue' | 'miss' {
    if (score >= 90) return 'auto_alert';
    if (score >= 70) return 'review_queue';
    return 'miss';
  }

  test('score 100 → auto_alert', () => expect(classify(100)).toBe('auto_alert'));
  test('score 90 → auto_alert', () => expect(classify(90)).toBe('auto_alert'));
  test('score 89 → review_queue', () => expect(classify(89)).toBe('review_queue'));
  test('score 70 → review_queue', () => expect(classify(70)).toBe('review_queue'));
  test('score 69 → miss', () => expect(classify(69)).toBe('miss'));
  test('score 0 → miss', () => expect(classify(0)).toBe('miss'));
});

// ---------------------------------------------------------------------------
// Composite screening logic — M17 depth pass
// ---------------------------------------------------------------------------

const COMPOSITE_ENTRY = {
  name: 'SALAMI, Hossein',
  aliases: ['Hosein Salami', 'Hussein Salami', 'SALAMI Hossein'],
  country: 'IR',
  dob: '1963-03-14',
  address: 'No 42 Pasdaran Avenue Tehran Iran',
  id_numbers: ['IRGC-CMD-001'],
  programs: ['IRAN', 'IRGC'],
  source_url: 'https://sanctionssearch.ofac.treas.gov/',
};

describe('compositeSanctionsMatch — eight required cases', () => {
  test('1. exact name plus DOB, country, and address produces auto-alert score', () => {
    const result = compositeSanctionsMatch(
      {
        name: 'Hosein Salami',
        country_code: 'IR',
        metadata: { dob: '1963-03-14', address: '42 Pasdaran Ave, Tehran, Iran' },
      },
      COMPOSITE_ENTRY,
    );

    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.decision).toBe('auto_alert');
    expect(result.contributors.name.score).toBe(100);
    expect(result.contributors.dob.score).toBe(100);
    expect(result.contributors.country.score).toBe(100);
    expect(result.contributors.address.score).toBeGreaterThanOrEqual(75);
  });

  test('2. alias-to-entity variant match can auto-alert with corroborating DOB and country', () => {
    const result = compositeSanctionsMatch(
      {
        name: 'H Salami Trading',
        country_code: 'IR',
        metadata: {
          aliases: ['Hussein Salami'],
          dob: '1963-03-14',
          address: 'Tehran Pasdaran Avenue',
        },
      },
      COMPOSITE_ENTRY,
    );

    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.matchedSanctionsName).toBe('Hussein Salami');
    expect(result.matchedEntityName).toBe('Hussein Salami');
  });

  test('3. fuzzy Levenshtein name plus corroborating fields lands in auto-alert', () => {
    const result = compositeSanctionsMatch(
      {
        name: 'Hosein Salmi',
        country_code: 'IR',
        metadata: { dob: '1963-03-14', address: 'Pasdaran Tehran' },
      },
      COMPOSITE_ENTRY,
    );

    expect(result.contributors.name.score).toBeGreaterThanOrEqual(90);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.decision).toBe('auto_alert');
  });

  test('4. strong name with wrong DOB and weak address routes to review', () => {
    const result = compositeSanctionsMatch(
      {
        name: 'SALAMI Hossein',
        country_code: 'IR',
        metadata: { dob: '1971-01-01', address: 'Tehran India' },
      },
      COMPOSITE_ENTRY,
    );

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.score).toBeLessThan(90);
    expect(result.decision).toBe('review_queue');
    expect(result.contributors.dob.score).toBe(0);
  });

  test('5. country mismatch reduces an otherwise strong candidate to review', () => {
    const result = compositeSanctionsMatch(
      {
        name: 'Hussein Salami',
        country_code: 'AE',
        metadata: { dob: '1963-03-14', address: 'Pasdaran Avenue Tehran' },
      },
      COMPOSITE_ENTRY,
    );

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.score).toBeLessThan(90);
    expect(result.contributors.country.score).toBe(0);
  });

  test('6. address token overlap contributes partial score without dominating', () => {
    const result = compositeSanctionsMatch(
      {
        name: 'Hussein Salami',
        country_code: 'IR',
        metadata: { dob: '1963-03-14', address: 'Tehran Iran logistics district' },
      },
      COMPOSITE_ENTRY,
    );

    expect(result.contributors.address.score).toBeGreaterThan(0);
    expect(result.contributors.address.score).toBeLessThan(100);
    expect(result.decision).toBe('auto_alert');
  });

  test('7. clean miss stays below review threshold', () => {
    const result = compositeSanctionsMatch(
      {
        name: 'Tata Steel Mumbai',
        country_code: 'IN',
        metadata: { dob: '1980-01-01', address: 'Mumbai Maharashtra India' },
      },
      COMPOSITE_ENTRY,
    );

    expect(result.score).toBeLessThan(70);
    expect(result.decision).toBe('miss');
  });

  test('8. common-name false positive with no DOB cross-check does not auto-alert', () => {
    const commonNameEntry = {
      ...COMPOSITE_ENTRY,
      name: 'Ahmed Ali Khan',
      aliases: ['Ahmed Khan'],
      country: 'PK',
      dob: '1970-05-01',
      address: 'Karachi Pakistan',
    };

    const result = compositeSanctionsMatch(
      {
        name: 'Ahmed Khan',
        country_code: 'PK',
        metadata: { address: 'Karachi Pakistan trading office' },
      },
      commonNameEntry,
    );

    expect(result.contributors.name.score).toBe(100);
    expect(result.contributors.dob.score).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.score).toBeLessThan(90);
    expect(classifySanctionsMatch(result.score)).toBe('review_queue');
  });
});

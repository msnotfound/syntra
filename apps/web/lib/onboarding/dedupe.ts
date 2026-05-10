export interface ExistingEntity {
  _id: string;
  name: string;
  supplier_tier?: 1 | 2 | 3 | null;
}

export interface DedupeMatch {
  candidate: string;
  existing_id?: string;
  existing_name?: string;
  similarity: number;
  suggested_tier: 1 | 2 | 3;
  action: 'add' | 'dedupe' | 'skip';
}

const DEDUPE_THRESHOLD = 0.6;
const SKIP_THRESHOLD = 0.95;

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function tokenSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setA = new Set(ta);
  const setB = new Set(tb);
  let intersection = 0;
  setA.forEach(t => { if (setB.has(t)) intersection++; });
  return intersection / Math.max(setA.size, setB.size);
}

function tierFromDensity(density: number): 1 | 2 | 3 {
  if (density >= 3) return 1;
  if (density >= 1) return 2;
  return 3;
}

export function dedupeAndTier(
  candidateNames: string[],
  existingEntities: ExistingEntity[],
  mentionDensity: Record<string, number> = {},
): DedupeMatch[] {
  return candidateNames.map(candidate => {
    const density = mentionDensity[candidate] ?? 0;
    const suggested_tier = tierFromDensity(density);

    let bestSim = 0;
    let bestMatch: ExistingEntity | null = null;

    for (const entity of existingEntities) {
      const sim = tokenSimilarity(candidate, entity.name);
      if (sim > bestSim) {
        bestSim = sim;
        bestMatch = entity;
      }
    }

    if (bestMatch && bestSim >= SKIP_THRESHOLD) {
      return {
        candidate,
        existing_id: bestMatch._id,
        existing_name: bestMatch.name,
        similarity: bestSim,
        suggested_tier,
        action: 'skip' as const,
      };
    }

    if (bestMatch && bestSim >= DEDUPE_THRESHOLD) {
      return {
        candidate,
        existing_id: bestMatch._id,
        existing_name: bestMatch.name,
        similarity: bestSim,
        suggested_tier,
        action: 'dedupe' as const,
      };
    }

    return {
      candidate,
      similarity: bestSim,
      suggested_tier,
      action: 'add' as const,
    };
  });
}

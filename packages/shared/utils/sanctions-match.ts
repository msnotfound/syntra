import { bestMatchScore, nameMatchScore } from './index.js';

export type SanctionsDecision = 'auto_alert' | 'review_queue' | 'miss';

export interface SanctionsMatchEntity {
  name: string;
  country_code?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface SanctionsMatchEntry {
  name: string;
  aliases?: string[];
  country?: string | null;
  dob?: string | null;
  address?: string | null;
}

export interface SanctionsContributor {
  score: number;
  weight: number;
  weightedScore: number;
  detail: string;
}

export interface SanctionsCompositeResult {
  score: number;
  decision: SanctionsDecision;
  matchedEntityName: string;
  matchedSanctionsName: string;
  contributors: {
    name: SanctionsContributor;
    dob: SanctionsContributor;
    country: SanctionsContributor;
    address: SanctionsContributor;
  };
}

const WEIGHTS = {
  name: 0.5,
  dob: 0.2,
  country: 0.15,
  address: 0.15,
} as const;

const ADDRESS_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'avenue',
  'ave',
  'building',
  'co',
  'company',
  'corp',
  'corporation',
  'district',
  'floor',
  'inc',
  'limited',
  'llc',
  'ltd',
  'no',
  'office',
  'road',
  'street',
  'st',
  'suite',
  'the',
]);

export function classifySanctionsMatch(score: number): SanctionsDecision {
  if (score >= 90) return 'auto_alert';
  if (score >= 70) return 'review_queue';
  return 'miss';
}

export function getEntityNameVariants(entity: SanctionsMatchEntity): string[] {
  const variants = new Set<string>();
  addString(variants, entity.name);

  const metadata: Record<string, unknown> = entity.metadata ?? {};
  const aliases = metadata.aliases;
  if (Array.isArray(aliases)) {
    for (const alias of aliases) addString(variants, alias);
  }

  for (const key of ['legal_name', 'trade_name', 'registered_name']) {
    addString(variants, metadata[key]);
  }

  return [...variants];
}

export function addressTokenScore(entityAddress: unknown, entryAddress: unknown): number {
  if (!isFilledString(entryAddress)) return 100;
  if (!isFilledString(entityAddress)) return 0;

  const entityTokens = tokenizeAddress(entityAddress);
  const entryTokens = tokenizeAddress(entryAddress);
  if (entryTokens.length === 0) return 100;
  if (entityTokens.length === 0) return 0;

  const entitySet = new Set(entityTokens);
  const intersection = entryTokens.filter(token => entitySet.has(token)).length;
  const recall = intersection / entryTokens.length;
  return Math.round(recall * 100);
}

export function compositeSanctionsMatch(
  entity: SanctionsMatchEntity,
  entry: SanctionsMatchEntry,
): SanctionsCompositeResult {
  const metadata: Record<string, unknown> = entity.metadata ?? {};
  const entityNames = getEntityNameVariants(entity);
  const nameResult = bestMatchScore(entityNames, {
    name: entry.name,
    aliases: entry.aliases ?? [],
  });

  const dobScore = compareOptionalExact(metadata.dob, entry.dob);
  const countryScore = compareOptionalCountry(entity.country_code, entry.country);
  const addressScore = addressTokenScore(metadata.address, entry.address);

  const contributors = {
    name: contributor(nameResult.score, WEIGHTS.name, `${nameResult.entityName} <-> ${nameResult.matchedName}`),
    dob: contributor(dobScore, WEIGHTS.dob, optionalDetail(metadata.dob, entry.dob)),
    country: contributor(countryScore, WEIGHTS.country, optionalDetail(entity.country_code, entry.country)),
    address: contributor(addressScore, WEIGHTS.address, optionalDetail(metadata.address, entry.address)),
  };

  const score = Math.round(
    contributors.name.weightedScore +
    contributors.dob.weightedScore +
    contributors.country.weightedScore +
    contributors.address.weightedScore,
  );

  return {
    score,
    decision: classifySanctionsMatch(score),
    matchedEntityName: nameResult.entityName,
    matchedSanctionsName: nameResult.matchedName,
    contributors,
  };
}

function contributor(score: number, weight: number, detail: string): SanctionsContributor {
  return {
    score,
    weight,
    weightedScore: Math.round(score * weight),
    detail,
  };
}

function compareOptionalExact(entityValue: unknown, entryValue: unknown): number {
  if (!isFilledString(entryValue)) return 100;
  if (!isFilledString(entityValue)) return 0;
  return normalizeDateish(entityValue) === normalizeDateish(entryValue) ? 100 : 0;
}

function compareOptionalCountry(entityCountry: unknown, entryCountry: unknown): number {
  if (!isFilledString(entryCountry)) return 100;
  if (!isFilledString(entityCountry)) return 0;
  const entityNormalized = normalizeCountry(entityCountry);
  const entryNormalized = normalizeCountry(entryCountry);
  if (entityNormalized === entryNormalized) return 100;
  return nameMatchScore(entityNormalized, entryNormalized) >= 90 ? 100 : 0;
}

function tokenizeAddress(value: string): string[] {
  return normalize(value)
    .split(' ')
    .filter(token => token.length >= 2 && !ADDRESS_STOPWORDS.has(token));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeDateish(value: string): string {
  return normalize(value).replace(/\s+/g, '-');
}

function normalizeCountry(value: string): string {
  return normalize(value).replace(/\s+/g, '');
}

function optionalDetail(entityValue: unknown, entryValue: unknown): string {
  const entityText = isFilledString(entityValue) ? entityValue : 'missing';
  const entryText = isFilledString(entryValue) ? entryValue : 'not applicable';
  return `${entityText} <-> ${entryText}`;
}

function addString(values: Set<string>, value: unknown): void {
  if (isFilledString(value)) values.add(value.trim());
}

function isFilledString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

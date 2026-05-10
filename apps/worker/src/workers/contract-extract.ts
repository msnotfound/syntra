import crypto from 'crypto';
import { Queue, Worker } from 'bullmq';
import { Types } from 'mongoose';
import {
  Contract,
  ContractExtractionRun,
  Counterparty,
  IntelClaim,
  SourceReliability,
  SupplierLink,
  WatchlistEntity,
  connectDb,
} from '@syntra/db';
import type {
  ContractType,
  IContractExtracted,
  ExtractedCounterpartyRole,
  ExtractedKeyDateType,
  ExtractedObligationStatus,
  CounterpartyRole,
} from '@syntra/db';
import { CONTRACT_TERMS_EXTRACT, callLLMJson, renderTemplate } from '@syntra/llm';
import { nameMatchScore } from '@syntra/shared';
import { fetchContent } from '../../../web/lib/onboarding/fetch.js';

const REDIS_URL = process.env.UPSTASH_REDIS_URL;
const connection = REDIS_URL
  ? { url: REDIS_URL }
  : { host: 'localhost', port: 6379 };

const MAX_CHUNK_CHARS = 25_000;
const MIN_COUNTERPARTY_MATCH = 85;
const CONTRACT_SOURCE_ID = 'llm-contract-extract';

let queue: Queue | null = null;

export interface ContractExtractionPayload {
  contract_id?: string;
  doc_url: string;
  org_id: string;
  force?: boolean;
  extraction_run_id?: string;
}

export interface ContractFetchedDocument {
  text: string;
  binary: Buffer;
  strategy: string;
  page_count?: number;
}

export type ContractDocumentFetcher = (docUrl: string) => Promise<ContractFetchedDocument>;

export interface ContractExtractionResult {
  status: 'completed' | 'duplicate';
  extraction_run_id: string;
  contract_id: string;
  source_doc_hash: string;
}

interface RawExtractedContract {
  counterparties?: Array<{ name?: string; role?: string; entity_id?: string | null }>;
  obligations?: Array<{ party?: string; description?: string; due_date?: string | null; status?: string }>;
  key_dates?: Array<{ label?: string; date?: string; type?: string }>;
  value_clauses?: Array<{ description?: string; amount_usd?: number | null; currency?: string; trigger?: string | null }>;
  force_majeure?: { covered?: boolean; excerpt?: string | null };
  exclusivity?: { exclusive?: boolean; scope?: string | null; geographies?: string[] };
  confidence_pct?: number;
}

interface LinkedCounterparty {
  name: string;
  role: ExtractedCounterpartyRole;
  entityId: Types.ObjectId;
  counterpartyId: Types.ObjectId;
}

interface EntityNameLike {
  _id: unknown;
  name?: unknown;
}

interface CounterpartyEntityLike {
  _id: unknown;
  entity_id?: unknown;
}

export function getContractExtractQueue(): Queue {
  if (!queue) queue = new Queue('contract-extract', { connection });
  return queue;
}

export function startContractExtractWorker() {
  const worker = new Worker('contract-extract', async (job) => {
    await connectDb();
    await extractContractDocument(job.data as ContractExtractionPayload);
  }, { connection });

  worker.on('failed', (job, err) =>
    console.error('[contract-extract] Job failed', job?.id, err.message),
  );
  return worker;
}

export async function extractContractDocument(
  payload: ContractExtractionPayload,
  deps: { fetcher?: ContractDocumentFetcher } = {},
): Promise<ContractExtractionResult> {
  const started = Date.now();
  const orgId = new Types.ObjectId(payload.org_id);
  const run = payload.extraction_run_id
    ? await ContractExtractionRun.findOneAndUpdate(
      { _id: payload.extraction_run_id, org_id: orgId },
      { $set: { status: 'running', started_at: new Date(), error: null } },
      { new: true },
    )
    : await ContractExtractionRun.create({
      org_id: orgId,
      doc_url: payload.doc_url,
      status: 'running',
      started_at: new Date(),
    });

  if (!run) throw new Error('Contract extraction run not found');

  try {
    const fetched = await (deps.fetcher ?? defaultContractFetcher)(payload.doc_url);
    const sourceDocHash = crypto.createHash('sha256').update(fetched.binary).digest('hex');
    await ContractExtractionRun.updateOne({ _id: run._id }, { $set: { input_doc_hash: sourceDocHash } });

    const duplicate = !payload.force
      ? await Contract.findOne({
        org_id: orgId,
        source_doc_hash: sourceDocHash,
        ...(payload.contract_id ? { _id: { $ne: new Types.ObjectId(payload.contract_id) } } : {}),
      }).lean()
      : null;

    if (duplicate) {
      await ContractExtractionRun.updateOne(
        { _id: run._id },
        {
          $set: {
            contract_id: duplicate._id,
            status: 'duplicate',
            success: true,
            latency_ms: Date.now() - started,
            completed_at: new Date(),
          },
        },
      );
      return {
        status: 'duplicate',
        extraction_run_id: String(run._id),
        contract_id: String(duplicate._id),
        source_doc_hash: sourceDocHash,
      };
    }

    const chunks = chunkText(fetched.text, MAX_CHUNK_CHARS);
    const extractedChunks: RawExtractedContract[] = [];
    let tokensUsed = 0;

    for (const [index, chunk] of chunks.entries()) {
      const prompt = renderTemplate(CONTRACT_TERMS_EXTRACT.template, {
        doc_url: payload.doc_url,
        chunk_index: index + 1,
        chunk_count: chunks.length,
        text: chunk,
      });
      tokensUsed += estimateTokens(CONTRACT_TERMS_EXTRACT.system + prompt);
      const extracted = await callLLMJson<RawExtractedContract>(
        CONTRACT_TERMS_EXTRACT.model,
        CONTRACT_TERMS_EXTRACT.system,
        prompt,
        async () => fallbackExtractContract(chunk),
      );
      tokensUsed += estimateTokens(JSON.stringify(extracted));
      extractedChunks.push(extracted);
    }

    const extracted = normalizeExtractedContract(mergeExtractedContracts(extractedChunks));
    const linkedCounterparties = await linkCounterparties(orgId, extracted);
    extracted.counterparties = extracted.counterparties.map(cp => {
      const linked = linkedCounterparties.find(item => sameName(item.name, cp.name) && item.role === cp.role);
      return { ...cp, entity_id: linked?.entityId ?? cp.entity_id ?? null };
    });

    const supplierLinks = await createImpliedSupplierLinks(orgId, linkedCounterparties, extracted.exclusivity.scope);
    const primaryCounterparty =
      linkedCounterparties.find(cp => cp.role === 'seller') ??
      linkedCounterparties.find(cp => cp.role !== 'buyer') ??
      linkedCounterparties[0];

    if (!primaryCounterparty) {
      throw new Error('No counterparties extracted from contract');
    }

    const contractFields = {
      org_id: orgId,
      counterparty_id: primaryCounterparty.counterpartyId,
      ref: await resolveContractRef(orgId, payload.contract_id, sourceDocHash),
      type: inferContractType(extracted),
      value_usd: inferContractValue(extracted),
      expires_at: inferExpiryDate(extracted),
      terms_summary: summarizeExtractedTerms(extracted),
      force_majeure_clauses: extracted.force_majeure.excerpt ? [extracted.force_majeure.excerpt] : [],
      source_doc_url: payload.doc_url,
      source_doc_hash: sourceDocHash,
      extracted,
      extraction_run_id: String(run._id),
      extraction_confidence_pct: mergeConfidence(extractedChunks),
      extracted_at: new Date(),
      active: true,
    };

    const contract = payload.contract_id
      ? await Contract.findOneAndUpdate(
        { _id: payload.contract_id, org_id: orgId },
        { $set: contractFields },
        { new: true, upsert: false },
      )
      : await Contract.create(contractFields);

    if (!contract) throw new Error('Contract not found for extraction update');

    await Counterparty.updateMany(
      { _id: { $in: linkedCounterparties.map(cp => cp.counterpartyId) }, contract_id: null },
      { $set: { contract_id: contract._id } },
    );
    await emitContractDigestContext(orgId, payload.doc_url, contract._id as Types.ObjectId, extracted, supplierLinks);

    await ContractExtractionRun.updateOne(
      { _id: run._id },
      {
        $set: {
          contract_id: contract._id,
          llm_tokens_used: tokensUsed,
          status: 'completed',
          success: true,
          error: null,
          latency_ms: Date.now() - started,
          completed_at: new Date(),
        },
      },
    );

    return {
      status: 'completed',
      extraction_run_id: String(run._id),
      contract_id: String(contract._id),
      source_doc_hash: sourceDocHash,
    };
  } catch (err) {
    await ContractExtractionRun.updateOne(
      { _id: run._id },
      {
        $set: {
          status: 'error',
          success: false,
          error: err instanceof Error ? err.message : String(err),
          latency_ms: Date.now() - started,
          completed_at: new Date(),
        },
      },
    );
    throw err;
  }
}

async function defaultContractFetcher(docUrl: string): Promise<ContractFetchedDocument> {
  const content = await fetchContent(docUrl);
  const binary = content.binary ?? await fetchBinary(docUrl);
  return {
    text: content.text,
    binary,
    strategy: content.strategy,
    page_count: content.page_count,
  };
}

async function fetchBinary(docUrl: string): Promise<Buffer> {
  const res = await fetch(docUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Syntra Contract Bot)' } });
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function chunkText(text: string, maxChars: number): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) return [''];
  const chunks: string[] = [];
  for (let i = 0; i < normalized.length; i += maxChars) {
    chunks.push(normalized.slice(i, i + maxChars));
  }
  return chunks;
}

function mergeExtractedContracts(chunks: RawExtractedContract[]): RawExtractedContract {
  return {
    counterparties: uniqueByNameRole(chunks.flatMap(c => c.counterparties ?? [])),
    obligations: uniqueByDescription(chunks.flatMap(c => c.obligations ?? [])),
    key_dates: uniqueByLabelDate(chunks.flatMap(c => c.key_dates ?? [])),
    value_clauses: uniqueByDescription(chunks.flatMap(c => c.value_clauses ?? [])),
    force_majeure: chunks.find(c => c.force_majeure?.covered)?.force_majeure ?? { covered: false, excerpt: null },
    exclusivity: chunks.find(c => c.exclusivity?.exclusive)?.exclusivity ?? { exclusive: false, scope: null, geographies: [] },
    confidence_pct: mergeConfidence(chunks),
  };
}

function normalizeExtractedContract(raw: RawExtractedContract): IContractExtracted {
  return {
    counterparties: (raw.counterparties ?? []).flatMap(cp => {
      const name = cleanText(cp.name);
      const role = normalizeCounterpartyRole(cp.role);
      if (!name || !role) return [];
      return [{ name, role, entity_id: parseObjectId(cp.entity_id) }];
    }),
    obligations: (raw.obligations ?? []).flatMap(item => {
      const party = cleanText(item.party);
      const description = cleanText(item.description);
      if (!party || !description) return [];
      return [{
        party,
        description,
        due_date: parseDateOrNull(item.due_date),
        status: normalizeObligationStatus(item.status),
      }];
    }),
    key_dates: (raw.key_dates ?? []).flatMap(item => {
      const label = cleanText(item.label);
      const date = parseDateOrNull(item.date);
      const type = normalizeKeyDateType(item.type);
      if (!label || !date || !type) return [];
      return [{ label, date, type }];
    }),
    value_clauses: (raw.value_clauses ?? []).flatMap(item => {
      const description = cleanText(item.description);
      if (!description) return [];
      return [{
        description,
        amount_usd: typeof item.amount_usd === 'number' && Number.isFinite(item.amount_usd)
          ? Math.max(0, item.amount_usd)
          : null,
        currency: cleanText(item.currency) || 'USD',
        trigger: cleanText(item.trigger) || null,
      }];
    }),
    force_majeure: {
      covered: Boolean(raw.force_majeure?.covered),
      excerpt: cleanText(raw.force_majeure?.excerpt) || null,
    },
    exclusivity: {
      exclusive: Boolean(raw.exclusivity?.exclusive),
      scope: cleanText(raw.exclusivity?.scope) || null,
      geographies: [...new Set((raw.exclusivity?.geographies ?? []).map(cleanText).filter(Boolean))],
    },
  };
}

async function linkCounterparties(
  orgId: Types.ObjectId,
  extracted: IContractExtracted,
): Promise<LinkedCounterparty[]> {
  const entities = await WatchlistEntity.find({ org_id: orgId, active: true }).lean() as EntityNameLike[];
  const counterparties = await Counterparty.find({ org_id: orgId, active: true }).lean() as CounterpartyEntityLike[];
  const linked: LinkedCounterparty[] = [];

  for (const cp of extracted.counterparties) {
    const counterpartyRole = mapCounterpartyRole(cp.role);
    const existingCp = bestCounterpartyMatch(cp.name, counterparties, entities);
    if (existingCp && existingCp.score >= MIN_COUNTERPARTY_MATCH) {
      linked.push({
        name: cp.name,
        role: cp.role,
        entityId: asObjectId(existingCp.counterparty.entity_id),
        counterpartyId: asObjectId(existingCp.counterparty._id),
      });
      continue;
    }

    const existingEntity = bestEntityMatch(cp.name, entities);
    const entityId = existingEntity && existingEntity.score >= MIN_COUNTERPARTY_MATCH
      ? asObjectId(existingEntity.entity._id)
      : asObjectId((await WatchlistEntity.create({
        org_id: orgId,
        type: counterpartyRole === 'supplier' ? 'supplier' : 'supplier',
        name: cp.name,
        country_code: null,
        metadata: { source: 'extracted_contract' },
        active: true,
      }))._id);

    const counterparty = await Counterparty.create({
      org_id: orgId,
      entity_id: entityId,
      role: counterpartyRole,
      source: 'extracted_contract',
      risk_score: 50,
      relationship_value_usd: inferContractValue(extracted),
      active: true,
    });

    linked.push({
      name: cp.name,
      role: cp.role,
      entityId,
      counterpartyId: asObjectId(counterparty._id),
    });
  }

  return linked;
}

async function createImpliedSupplierLinks(
  orgId: Types.ObjectId,
  counterparties: LinkedCounterparty[],
  evidence: string | null,
): Promise<number> {
  const buyers = counterparties.filter(cp => cp.role === 'buyer');
  const sellers = counterparties.filter(cp => cp.role === 'seller');
  let changed = 0;

  for (const buyer of buyers) {
    for (const seller of sellers) {
      if (String(buyer.entityId) === String(seller.entityId)) continue;
      await SupplierLink.updateOne(
        {
          org_id: orgId,
          parent_entity_id: buyer.entityId,
          child_entity_id: seller.entityId,
        },
        {
          $setOnInsert: {
            tier_offset: 1,
            source: 'extracted',
            confidence_pct: 88,
            evidence: evidence ?? 'Buyer/seller relationship extracted from contract.',
          },
        },
        { upsert: true },
      );
      changed += 1;
    }
  }

  return changed;
}

async function emitContractDigestContext(
  _orgId: Types.ObjectId,
  docUrl: string,
  _contractId: Types.ObjectId,
  extracted: IContractExtracted,
  supplierLinks: number,
): Promise<void> {
  const source = await SourceReliability.findOneAndUpdate(
    { source_id: CONTRACT_SOURCE_ID },
    {
      $setOnInsert: {
        source_id: CONTRACT_SOURCE_ID,
        source_name: 'LLM Contract Extraction',
        admiralty_code: 'B',
        reliability_pct: 78,
        last_assessed_at: new Date(),
      },
    },
    { upsert: true, new: true },
  );
  if (!source) throw new Error('Contract extraction source reliability record not available');

  await IntelClaim.create({
    source_id: source._id,
    claim_text: `Contract extraction produced ${extracted.counterparties.length} counterparties, ${extracted.obligations.length} obligations, ${extracted.key_dates.length} key dates, and ${supplierLinks} supplier graph link(s).`,
    evidence_url: docUrl,
    asserted_at: new Date(),
    parent_claim_ids: [],
    claim_type: 'fact',
    alert_id: null,
  });
}

function bestCounterpartyMatch(name: string, counterparties: CounterpartyEntityLike[], entities: EntityNameLike[]) {
  const entityById = new Map(entities.map(entity => [String(entity._id), entity]));
  let best: { counterparty: CounterpartyEntityLike; score: number } | null = null;
  for (const counterparty of counterparties) {
    const entity = entityById.get(String(counterparty.entity_id));
    const entityName = typeof entity?.name === 'string' ? entity.name : '';
    const score = compareNames(name, entityName);
    if (!best || score > best.score) best = { counterparty, score };
  }
  return best;
}

function bestEntityMatch(name: string, entities: EntityNameLike[]) {
  let best: { entity: EntityNameLike; score: number } | null = null;
  for (const entity of entities) {
    const score = compareNames(name, typeof entity.name === 'string' ? entity.name : '');
    if (!best || score > best.score) best = { entity, score };
  }
  return best;
}

function compareNames(a: string, b: string): number {
  const an = normalizeLegalName(a);
  const bn = normalizeLegalName(b);
  if (!an || !bn) return 0;
  if (an === bn) return 100;
  const tokenScore = tokenOverlapScore(an, bn);
  return Math.max(tokenScore, nameMatchScore(an, bn));
}

function normalizeLegalName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(private|pvt|limited|ltd|llc|inc|corp|corporation|company|co)\b/g, '')
    .replace(/\bmfg\b/g, 'manufacturing')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenOverlapScore(a: string, b: string): number {
  const aTokens = new Set(a.split(' ').filter(Boolean));
  const bTokens = new Set(b.split(' ').filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  const intersection = [...aTokens].filter(token => bTokens.has(token)).length;
  return Math.round((intersection / Math.max(aTokens.size, bTokens.size)) * 100);
}

function sameName(a: string, b: string): boolean {
  return compareNames(a, b) >= MIN_COUNTERPARTY_MATCH;
}

function mapCounterpartyRole(role: ExtractedCounterpartyRole): CounterpartyRole {
  if (role === 'seller') return 'supplier';
  if (role === 'buyer') return 'customer';
  if (role === 'agent') return 'broker';
  return 'logistics';
}

function inferContractType(extracted: IContractExtracted): ContractType {
  if (extracted.counterparties.some(cp => cp.role === 'seller') && extracted.counterparties.some(cp => cp.role === 'buyer')) {
    return 'supply';
  }
  return 'other';
}

function inferContractValue(extracted: IContractExtracted): number {
  return Math.max(0, Math.round(extracted.value_clauses.find(v => typeof v.amount_usd === 'number')?.amount_usd ?? 0));
}

function inferExpiryDate(extracted: IContractExtracted): Date | null {
  return extracted.key_dates.find(d => d.type === 'expiry')?.date ?? null;
}

async function resolveContractRef(orgId: Types.ObjectId, contractId: string | undefined, hash: string): Promise<string> {
  if (contractId) {
    const existing = await Contract.findOne({ _id: contractId, org_id: orgId }).select('ref').lean();
    if (existing?.ref) return existing.ref;
  }
  return `EXT-${hash.slice(0, 10).toUpperCase()}`;
}

function summarizeExtractedTerms(extracted: IContractExtracted): string {
  const parts = [
    `${extracted.counterparties.length} counterparty${extracted.counterparties.length === 1 ? '' : 'ies'}`,
    `${extracted.obligations.length} obligation${extracted.obligations.length === 1 ? '' : 's'}`,
    `${extracted.key_dates.length} key date${extracted.key_dates.length === 1 ? '' : 's'}`,
  ];
  if (extracted.force_majeure.covered) parts.push('force majeure covered');
  if (extracted.exclusivity.exclusive) parts.push('exclusivity present');
  return parts.join('; ');
}

function mergeConfidence(chunks: RawExtractedContract[]): number {
  const scores = chunks
    .map(c => c.confidence_pct)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (scores.length === 0) return 0;
  return Math.max(0, Math.min(100, Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)));
}

function fallbackExtractContract(text: string): RawExtractedContract {
  const amount = text.match(/(?:USD|\$)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i);
  return {
    counterparties: [],
    obligations: [],
    key_dates: [],
    value_clauses: amount ? [{
      description: 'Detected monetary clause.',
      amount_usd: Number(amount[1].replace(/,/g, '')),
      currency: 'USD',
      trigger: null,
    }] : [],
    force_majeure: { covered: /force majeure/i.test(text), excerpt: /force majeure/i.test(text) ? extractSentence(text, /force majeure/i) : null },
    exclusivity: { exclusive: /exclusive|exclusivity/i.test(text), scope: null, geographies: [] },
    confidence_pct: 35,
  };
}

function extractSentence(text: string, pattern: RegExp): string | null {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return cleanText(sentences.find(sentence => pattern.test(sentence)) ?? '').slice(0, 320) || null;
}

function uniqueByNameRole<T extends { name?: string; role?: string }>(rows: T[]): T[] {
  return uniqueBy(rows, row => `${normalizeLegalName(row.name ?? '')}:${row.role ?? ''}`);
}

function uniqueByDescription<T extends { description?: string }>(rows: T[]): T[] {
  return uniqueBy(rows, row => cleanText(row.description).toLowerCase());
}

function uniqueByLabelDate<T extends { label?: string; date?: string }>(rows: T[]): T[] {
  return uniqueBy(rows, row => `${cleanText(row.label).toLowerCase()}:${row.date ?? ''}`);
}

function uniqueBy<T>(rows: T[], keyFn: (row: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = keyFn(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function parseObjectId(value: unknown): Types.ObjectId | null {
  return typeof value === 'string' && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;
}

function parseDateOrNull(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeCounterpartyRole(value: unknown): ExtractedCounterpartyRole | null {
  return value === 'buyer' || value === 'seller' || value === 'guarantor' || value === 'agent'
    ? value
    : null;
}

function normalizeObligationStatus(value: unknown): ExtractedObligationStatus {
  return value === 'pending' || value === 'fulfilled' || value === 'breached' || value === 'unknown'
    ? value
    : 'unknown';
}

function normalizeKeyDateType(value: unknown): ExtractedKeyDateType | null {
  return value === 'effective' || value === 'expiry' || value === 'renewal' || value === 'milestone'
    ? value
    : null;
}

function asObjectId(value: unknown): Types.ObjectId {
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(String(value));
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

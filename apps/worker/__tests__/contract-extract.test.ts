import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import crypto from 'crypto';
import {
  Contract,
  ContractExtractionRun,
  Counterparty,
  Organization,
  SupplierLink,
  WatchlistEntity,
} from '@syntra/db';
import { callLLMJson } from '@syntra/llm';
import {
  extractContractDocument,
  type ContractDocumentFetcher,
  type ContractExtractionPayload,
} from '../src/workers/contract-extract';

jest.mock('@syntra/llm', () => ({
  callLLMJson: jest.fn(),
  renderTemplate: jest.fn((template: string, vars: Record<string, unknown>) =>
    template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? '')),
  ),
}));

const mockedCallLLMJson = callLLMJson as jest.MockedFunction<typeof callLLMJson>;

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
  mockedCallLLMJson.mockReset();
});

function contractExtractionResponse() {
  return {
    counterparties: [
      { name: 'Sundaram Pharma Ltd', role: 'buyer', entity_id: null },
      { name: 'Kandla API Manufacturing Pvt Ltd', role: 'seller', entity_id: null },
    ],
    obligations: [
      {
        party: 'Kandla API Manufacturing Pvt Ltd',
        description: 'Deliver monthly API batches under validated cold-chain controls.',
        due_date: '2026-09-30',
        status: 'pending',
      },
    ],
    key_dates: [
      { label: 'Effective Date', date: '2026-04-01', type: 'effective' },
      { label: 'Renewal Notice', date: '2027-01-31', type: 'renewal' },
    ],
    value_clauses: [
      {
        description: 'Annual committed purchase volume.',
        amount_usd: 1200000,
        currency: 'USD',
        trigger: 'minimum annual volume',
      },
    ],
    force_majeure: {
      covered: true,
      excerpt: 'Force majeure includes port closure, epidemic controls, war, and export restrictions.',
    },
    exclusivity: {
      exclusive: true,
      scope: 'Kandla supplier has exclusive API supply rights for West India production lines.',
      geographies: ['India'],
    },
    confidence_pct: 91,
  };
}

async function seedOrgGraph() {
  const org = await Organization.create({
    name: 'Sundaram Pharma',
    slug: 'sundaram-pharma',
    plan: 'growth',
    status: 'active',
    contact_email: 'ops@sundaram.example',
    industry: 'pharmaceuticals',
  });

  const buyerEntity = await WatchlistEntity.create({
    org_id: org._id,
    type: 'supplier',
    name: 'Sundaram Pharma Ltd',
    country_code: 'IN',
    metadata: { primary_org_entity: true },
    active: true,
  });

  const sellerEntity = await WatchlistEntity.create({
    org_id: org._id,
    type: 'supplier',
    name: 'Kandla API Mfg Private Limited',
    country_code: 'IN',
    metadata: {},
    active: true,
  });

  const sellerCounterparty = await Counterparty.create({
    org_id: org._id,
    entity_id: sellerEntity._id,
    role: 'supplier',
    risk_score: 38,
    relationship_value_usd: 900000,
    active: true,
  });

  return { org, buyerEntity, sellerEntity, sellerCounterparty };
}

function makeFetcher(text = 'Supply agreement text with force majeure, exclusivity, renewal, and USD value.'): ContractDocumentFetcher {
  const binary = Buffer.from(`%PDF-1.7\n${text}`);
  return jest.fn(async () => ({
    text,
    binary,
    strategy: 'pdf',
    page_count: 8,
  }));
}

function payload(orgId: unknown, docUrl = 'https://example.com/supply-agreement.pdf'): ContractExtractionPayload {
  return { org_id: String(orgId), doc_url: docUrl };
}

test('idempotency short-circuits when org already has the same source_doc_hash', async () => {
  const { org, sellerCounterparty } = await seedOrgGraph();
  const binary = Buffer.from('%PDF-1.7\nsame document');
  const hash = crypto.createHash('sha256').update(binary).digest('hex');
  await Contract.create({
    org_id: org._id,
    counterparty_id: sellerCounterparty._id,
    ref: 'EXISTING-HASH',
    type: 'supply',
    value_usd: 1000,
    source_doc_url: 'https://example.com/old.pdf',
    source_doc_hash: hash,
    extracted_at: new Date(),
  });

  const fetcher: ContractDocumentFetcher = jest.fn(async () => ({
    text: 'same document',
    binary,
    strategy: 'pdf',
  }));

  const result = await extractContractDocument(payload(org._id), { fetcher });

  expect(result.status).toBe('duplicate');
  expect(mockedCallLLMJson).not.toHaveBeenCalled();
  expect(await Contract.countDocuments({ org_id: org._id })).toBe(1);
  const run = await ContractExtractionRun.findById(result.extraction_run_id).lean();
  expect(run?.success).toBe(true);
  expect(run?.status).toBe('duplicate');
});

test('fixture extraction persists all extracted fields and run metadata', async () => {
  const { org } = await seedOrgGraph();
  mockedCallLLMJson.mockResolvedValue(contractExtractionResponse());

  const result = await extractContractDocument(payload(org._id), { fetcher: makeFetcher() });

  expect(result.status).toBe('completed');
  const contract = await Contract.findById(result.contract_id).lean();
  expect(contract?.source_doc_hash).toHaveLength(64);
  expect(contract?.extracted.counterparties).toHaveLength(2);
  expect(contract?.extracted.obligations[0].status).toBe('pending');
  expect(contract?.extracted.key_dates.map(d => d.type)).toContain('renewal');
  expect(contract?.extracted.value_clauses[0].amount_usd).toBe(1200000);
  expect(contract?.extracted.force_majeure.covered).toBe(true);
  expect(contract?.extracted.exclusivity.exclusive).toBe(true);
  expect(contract?.extraction_confidence_pct).toBe(91);
  expect(contract?.extracted_at).toBeInstanceOf(Date);

  const run = await ContractExtractionRun.findById(result.extraction_run_id).lean();
  expect(run?.contract_id?.toString()).toBe(result.contract_id);
  expect(run?.success).toBe(true);
  expect(run?.llm_tokens_used).toBeGreaterThan(0);
  expect(run?.latency_ms).toBeGreaterThanOrEqual(0);
});

test('counterparty matching links existing entities and creates missing counterparties with extracted_contract source', async () => {
  const { org, sellerEntity, sellerCounterparty } = await seedOrgGraph();
  mockedCallLLMJson.mockResolvedValue(contractExtractionResponse());

  const result = await extractContractDocument(payload(org._id), { fetcher: makeFetcher() });

  const contract = await Contract.findById(result.contract_id).lean();
  const seller = contract?.extracted.counterparties.find(cp => cp.name === 'Kandla API Manufacturing Pvt Ltd');
  const buyer = contract?.extracted.counterparties.find(cp => cp.name === 'Sundaram Pharma Ltd');

  expect(seller?.entity_id?.toString()).toBe(String(sellerEntity._id));
  expect(sellerCounterparty._id.toString()).toBe(contract?.counterparty_id.toString());

  expect(buyer?.entity_id).toBeTruthy();
  const createdCp = await Counterparty.findOne({ org_id: org._id, entity_id: buyer?.entity_id }).lean();
  expect(createdCp?.source).toBe('extracted_contract');
});

test('supplier link is created when buyer and seller roles imply a relationship', async () => {
  const { org, buyerEntity, sellerEntity } = await seedOrgGraph();
  mockedCallLLMJson.mockResolvedValue(contractExtractionResponse());

  await extractContractDocument(payload(org._id), { fetcher: makeFetcher() });

  const link = await SupplierLink.findOne({
    org_id: org._id,
    parent_entity_id: buyerEntity._id,
    child_entity_id: sellerEntity._id,
  }).lean();

  expect(link?.source).toBe('extracted');
  expect(link?.confidence_pct).toBeGreaterThanOrEqual(85);
  expect(link?.evidence).toContain('contract');
});

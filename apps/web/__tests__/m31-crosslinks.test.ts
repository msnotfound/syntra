/**
 * M31 cross-link query logic tests.
 * Tests pure data-joining helpers so no DB connection is needed.
 */

// --- helpers mirroring what the API routes do ---

interface Entity { _id: string; name: string; type: string }
interface Shipment { origin_entity_id: string; destination_entity_id: string; value_usd: number }
interface PO { _id: string; po_number: string; supplier_entity_id: string; status: string; total_usd: number }
interface Counterparty { _id: string; entity_id: string; role: string; risk_score: number; contract_id: string | null }
interface Contract { _id: string; counterparty_id: string; ref: string; type: string; value_usd: number; expires_at: string | null }

function resolveShipmentLinks(
  shipment: Shipment,
  entities: Entity[],
  pos: PO[],
): { origin: Entity | null; destination: Entity | null; purchase_orders: PO[] } {
  const entityMap = Object.fromEntries(entities.map(e => [e._id, e]));
  return {
    origin: entityMap[shipment.origin_entity_id] ?? null,
    destination: entityMap[shipment.destination_entity_id] ?? null,
    purchase_orders: pos.filter(p => p.supplier_entity_id === shipment.origin_entity_id),
  };
}

function resolveCounterpartyContracts(counterpartyId: string, contracts: Contract[]): Contract[] {
  return contracts.filter(c => c.counterparty_id === counterpartyId);
}

function resolvePOCounterparty(supplierEntityId: string, counterparties: Counterparty[]): Counterparty | null {
  return counterparties.find(c => c.entity_id === supplierEntityId) ?? null;
}

function resolveContractCounterparty(counterpartyId: string, counterparties: Counterparty[]): Counterparty | null {
  return counterparties.find(c => c._id === counterpartyId) ?? null;
}

// --- fixtures ---
const ENTITY_A: Entity = { _id: 'aaa', name: 'Acme Pharma', type: 'supplier' };
const ENTITY_B: Entity = { _id: 'bbb', name: 'Mumbai Port', type: 'port' };
const COUNTERPARTY_1: Counterparty = { _id: 'cp1', entity_id: 'aaa', role: 'supplier', risk_score: 65, contract_id: 'con1' };
const CONTRACT_1: Contract = { _id: 'con1', counterparty_id: 'cp1', ref: 'SLA-001', type: 'supply', value_usd: 500000, expires_at: '2027-01-01T00:00:00Z' };
const CONTRACT_2: Contract = { _id: 'con2', counterparty_id: 'cp1', ref: 'NDA-002', type: 'nda', value_usd: 0, expires_at: null };

describe('Shipment cross-link resolution', () => {
  const shipment: Shipment = { origin_entity_id: 'aaa', destination_entity_id: 'bbb', value_usd: 120000 };

  test('resolves origin and destination entities', () => {
    const links = resolveShipmentLinks(shipment, [ENTITY_A, ENTITY_B], []);
    expect(links.origin?.name).toBe('Acme Pharma');
    expect(links.destination?.name).toBe('Mumbai Port');
  });

  test('filters POs by origin entity (supplier)', () => {
    const pos: PO[] = [
      { _id: 'po1', po_number: 'PO-001', supplier_entity_id: 'aaa', status: 'approved', total_usd: 50000 },
      { _id: 'po2', po_number: 'PO-002', supplier_entity_id: 'ccc', status: 'draft', total_usd: 10000 },
    ];
    const links = resolveShipmentLinks(shipment, [ENTITY_A, ENTITY_B], pos);
    expect(links.purchase_orders).toHaveLength(1);
    expect(links.purchase_orders[0].po_number).toBe('PO-001');
  });

  test('returns null origin when entity not found', () => {
    const links = resolveShipmentLinks(shipment, [ENTITY_B], []);
    expect(links.origin).toBeNull();
    expect(links.destination?.name).toBe('Mumbai Port');
  });

  test('returns empty PO list when no supplier match', () => {
    const links = resolveShipmentLinks(shipment, [ENTITY_A, ENTITY_B], [
      { _id: 'po3', po_number: 'PO-003', supplier_entity_id: 'zzz', status: 'draft', total_usd: 0 },
    ]);
    expect(links.purchase_orders).toHaveLength(0);
  });
});

describe('Counterparty → Contracts cross-link', () => {
  test('returns all contracts for a given counterparty', () => {
    const contracts = resolveCounterpartyContracts('cp1', [CONTRACT_1, CONTRACT_2]);
    expect(contracts).toHaveLength(2);
    expect(contracts.map(c => c.ref)).toContain('SLA-001');
    expect(contracts.map(c => c.ref)).toContain('NDA-002');
  });

  test('returns empty when counterparty has no contracts', () => {
    const contracts = resolveCounterpartyContracts('cp99', [CONTRACT_1, CONTRACT_2]);
    expect(contracts).toHaveLength(0);
  });

  test('does not return contracts from another counterparty', () => {
    const OTHER: Contract = { _id: 'con3', counterparty_id: 'cp2', ref: 'SVC-003', type: 'service', value_usd: 100000, expires_at: null };
    const contracts = resolveCounterpartyContracts('cp1', [CONTRACT_1, CONTRACT_2, OTHER]);
    expect(contracts.every(c => c.counterparty_id === 'cp1')).toBe(true);
  });
});

describe('PO → Counterparty cross-link', () => {
  test('finds counterparty by supplier entity id', () => {
    const cp = resolvePOCounterparty('aaa', [COUNTERPARTY_1]);
    expect(cp?._id).toBe('cp1');
    expect(cp?.role).toBe('supplier');
  });

  test('returns null when no matching counterparty', () => {
    const cp = resolvePOCounterparty('zzz', [COUNTERPARTY_1]);
    expect(cp).toBeNull();
  });
});

describe('Contract → Counterparty cross-link', () => {
  test('resolves counterparty from contract counterparty_id', () => {
    const cp = resolveContractCounterparty('cp1', [COUNTERPARTY_1]);
    expect(cp?.entity_id).toBe('aaa');
    expect(cp?.risk_score).toBe(65);
  });

  test('returns null for unknown counterparty_id', () => {
    const cp = resolveContractCounterparty('cp99', [COUNTERPARTY_1]);
    expect(cp).toBeNull();
  });
});

describe('Risk score display logic', () => {
  function riskLabel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  test('score 70+ is high risk', () => expect(riskLabel(70)).toBe('high'));
  test('score 40–69 is medium risk', () => expect(riskLabel(55)).toBe('medium'));
  test('score 0–39 is low risk', () => expect(riskLabel(20)).toBe('low'));
  test('boundary 40 is medium', () => expect(riskLabel(40)).toBe('medium'));
  test('boundary 69 is medium', () => expect(riskLabel(69)).toBe('medium'));
});

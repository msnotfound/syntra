import { Types } from 'mongoose';
import {
  computeSupplierLinkConfidence,
  normalizeExtractedRelationships,
  resolveSupplierLinkWrite,
  type ExistingSupplierLinkLike,
} from '../src/workers/graph-extract';

describe('supplier relationship extraction helpers', () => {
  test('normalizes LLM supplier/buyer relationships and drops low-confidence rows', () => {
    const relationships = normalizeExtractedRelationships([
      {
        supplier_name: '  Beta Components Ltd. ',
        buyer_name: 'Acme Manufacturing',
        relationship: 'supplies',
        confidence_pct: 82,
        evidence: 'Beta Components supplies Acme Manufacturing with chipsets.',
      },
      {
        supplier_name: 'Unknown',
        buyer_name: 'Acme Manufacturing',
        relationship: 'supplies',
        confidence_pct: 54,
        evidence: 'Speculative social post.',
      },
    ]);

    expect(relationships).toEqual([
      {
        supplierName: 'Beta Components Ltd.',
        buyerName: 'Acme Manufacturing',
        confidencePct: 82,
        evidence: 'Beta Components supplies Acme Manufacturing with chipsets.',
      },
    ]);
  });

  test('scores manual links at 100, extracted links from source reliability, and imported CSV at 85', () => {
    expect(computeSupplierLinkConfidence('manual', 42)).toBe(100);
    expect(computeSupplierLinkConfidence('extracted', 78)).toBe(78);
    expect(computeSupplierLinkConfidence('imported_csv', 20)).toBe(85);
  });

  test('manual override wins over extracted and imported candidate links', () => {
    const existingManual: ExistingSupplierLinkLike = {
      _id: new Types.ObjectId(),
      source: 'manual',
      confidence_pct: 100,
    };

    const decision = resolveSupplierLinkWrite(existingManual, {
      source: 'extracted',
      confidence_pct: 82,
    });

    expect(decision.action).toBe('skip');
    expect(decision.reason).toBe('manual_existing');
  });

  test('non-manual links can be upgraded when a higher confidence candidate arrives', () => {
    const existingExtracted: ExistingSupplierLinkLike = {
      _id: new Types.ObjectId(),
      source: 'extracted',
      confidence_pct: 60,
    };

    const decision = resolveSupplierLinkWrite(existingExtracted, {
      source: 'imported_csv',
      confidence_pct: 85,
    });

    expect(decision).toEqual({
      action: 'update',
      fields: {
        source: 'imported_csv',
        confidence_pct: 85,
      },
    });
  });
});

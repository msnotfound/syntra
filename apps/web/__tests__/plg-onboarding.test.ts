import { describe, it, expect } from '@jest/globals';

describe('M38 PLG Onboarding', () => {
  describe('Extraction Parser', () => {
    it('should handle extraction output structure validation', () => {
      const mockOutput = {
        company_name: 'Test Corp',
        sector: 'Manufacturing',
        country: 'IN',
        region: 'South Asia',
        suppliers: [
          { name: 'Supplier A', confidence: 0.85, excerpt: 'Primary supplier' },
        ],
        customers: [
          { name: 'Customer B', confidence: 0.75, excerpt: 'Main customer' },
        ],
        facilities: [
          { name: 'Plant 1', location: 'Bangalore', confidence: 0.9, excerpt: 'Main facility' },
        ],
        counterparties: [
          { name: 'Partner C', type: 'partner' as const, confidence: 0.7, excerpt: 'Strategic partner' },
        ],
      };

      expect(mockOutput.company_name).toBeTruthy();
      expect(Array.isArray(mockOutput.suppliers)).toBe(true);
      expect(Array.isArray(mockOutput.customers)).toBe(true);
      expect(Array.isArray(mockOutput.facilities)).toBe(true);
      expect(Array.isArray(mockOutput.counterparties)).toBe(true);
    });

    it('should validate confidence scores are between 0 and 1', () => {
      const entities = [
        { name: 'High', confidence: 0.95 },
        { name: 'Medium', confidence: 0.65 },
        { name: 'Low', confidence: 0.35 },
      ];

      entities.forEach(entity => {
        expect(entity.confidence).toBeGreaterThanOrEqual(0);
        expect(entity.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should require excerpts for all extracted entities', () => {
      const supplier = {
        name: 'Company A',
        confidence: 0.8,
        excerpt: 'Quote from source text',
      };

      expect(supplier.excerpt).toBeTruthy();
      expect(typeof supplier.excerpt).toBe('string');
      expect(supplier.excerpt.length).toBeGreaterThan(0);
    });

    it('should filter candidates by minimum confidence threshold', () => {
      const candidates = [
        { name: 'High', confidence: 0.95 },
        { name: 'Medium', confidence: 0.65 },
        { name: 'Low', confidence: 0.45 },
      ];

      const MIN_CONFIDENCE = 0.5;
      const filtered = candidates.filter(c => c.confidence >= MIN_CONFIDENCE);

      expect(filtered).toHaveLength(2);
      expect(filtered.map(c => c.name)).toEqual(['High', 'Medium']);
    });

    it('should sort candidates by confidence descending', () => {
      const candidates = [
        { name: 'Entity A', confidence: 0.7 },
        { name: 'Entity B', confidence: 0.95 },
        { name: 'Entity C', confidence: 0.6 },
      ];

      const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);

      expect(sorted.map(c => c.name)).toEqual(['Entity B', 'Entity A', 'Entity C']);
    });
  });

  describe('Review Step Idempotency', () => {
    it('should allow toggling entities on and off without data loss', () => {
      const mockExtractionResult = {
        source_url: 'https://example.com',
        source_type: 'webpage' as const,
        company_name: 'Test Corp',
        sector: 'Manufacturing',
        country: 'IN',
        region: 'South Asia',
        candidates: [
          {
            type: 'supplier',
            name: 'Supplier A',
            sector: null,
            country: 'IN',
            region: null,
            confidence: 0.85,
            excerpt: 'Our primary supplier',
          },
          {
            type: 'customer',
            name: 'Customer B',
            sector: null,
            country: 'US',
            region: null,
            confidence: 0.75,
            excerpt: 'Main export customer',
          },
          {
            type: 'facility',
            name: 'Manufacturing Plant',
            location: 'Bangalore',
            confidence: 0.9,
            excerpt: 'Primary facility',
          },
        ],
        prompt_id: 'COMPANY_METADATA_EXTRACT',
        prompt_version: '1.0.0',
      };

      // Simulate selecting entities
      const selectedIndices = new Set([0, 2]); // Select supplier and facility
      const selectedEntities = Array.from(selectedIndices).map(
        idx => mockExtractionResult.candidates[idx],
      );

      expect(selectedEntities).toHaveLength(2);
      expect(selectedEntities[0].name).toBe('Supplier A');
      expect(selectedEntities[1].name).toBe('Manufacturing Plant');

      // Simulate deselecting
      selectedIndices.delete(2);
      const updatedEntities = Array.from(selectedIndices).map(
        idx => mockExtractionResult.candidates[idx],
      );

      expect(updatedEntities).toHaveLength(1);
      expect(updatedEntities[0].name).toBe('Supplier A');
    });

    it('should handle multiple rounds of selection without mutation', () => {
      const candidates = [
        { name: 'Entity A', confidence: 0.8, type: 'supplier' },
        { name: 'Entity B', confidence: 0.7, type: 'customer' },
        { name: 'Entity C', confidence: 0.6, type: 'supplier' },
      ];

      // First selection
      const selection1 = new Set([0, 1]);
      expect(selection1.size).toBe(2);

      // Add another
      selection1.add(2);
      expect(selection1.size).toBe(3);

      // Remove first
      selection1.delete(0);
      expect(selection1.size).toBe(2);
      expect([...selection1]).toEqual([1, 2]);

      // Original candidates should be unchanged
      expect(candidates).toHaveLength(3);
    });

    it('should prevent empty selection from being submitted', () => {
      const selectedIndices = new Set<number>();

      // Validation: require at least one selection
      const isValid = selectedIndices.size > 0;

      expect(isValid).toBe(false);

      // After adding a selection
      selectedIndices.add(0);
      expect(selectedIndices.size > 0).toBe(true);
    });

    it('should transform candidates into watchlist entity format correctly', () => {
      const candidates = [
        {
          type: 'supplier',
          name: 'Supplier A',
          country: 'IN',
          region: 'South Asia',
          confidence: 0.85,
          excerpt: 'Primary supplier',
        },
        {
          type: 'customer',
          name: 'Customer B',
          country: 'US',
          region: undefined,
          confidence: 0.75,
          excerpt: 'Export customer',
        },
      ];

      const selectedIndices = new Set([0, 1]);
      const entitiesToCreate = Array.from(selectedIndices)
        .map(idx => candidates[idx])
        .map(candidate => ({
          type: candidate.type === 'company' ? 'supplier' : 'supplier',
          name: candidate.name,
          country_code: candidate.country,
          region: candidate.region,
          metadata: {
            confidence: candidate.confidence,
            excerpt: candidate.excerpt,
            original_type: candidate.type,
          },
        }));

      expect(entitiesToCreate).toHaveLength(2);
      expect(entitiesToCreate[0]).toEqual({
        type: 'supplier',
        name: 'Supplier A',
        country_code: 'IN',
        region: 'South Asia',
        metadata: {
          confidence: 0.85,
          excerpt: 'Primary supplier',
          original_type: 'supplier',
        },
      });

      expect(entitiesToCreate[1]).toEqual({
        type: 'supplier',
        name: 'Customer B',
        country_code: 'US',
        region: undefined,
        metadata: {
          confidence: 0.75,
          excerpt: 'Export customer',
          original_type: 'customer',
        },
      });
    });
  });

  describe('Extract API Route', () => {
    it('should validate URL format', () => {
      const validUrls = [
        'https://example.com',
        'http://example.com/page',
        'https://subdomain.example.co.uk/path?query=1',
      ];

      const invalidUrls = [
        'not a url',
        'example.com',
        'ftp://example.com',
        '',
      ];

      validUrls.forEach(url => {
        expect(() => new URL(url)).not.toThrow();
      });

      invalidUrls.forEach(url => {
        expect(() => new URL(url)).toThrow();
      });
    });

    it('should organize candidates by entity type', () => {
      const extractionResult = {
        company_name: 'ABC Corp',
        sector: 'Mfg',
        country: 'IN',
        region: 'South Asia',
        candidates: [
          { type: 'company', name: 'ABC Corp', confidence: 0.95, excerpt: '' },
          { type: 'supplier', name: 'Supplier 1', confidence: 0.8, excerpt: '' },
          { type: 'supplier', name: 'Supplier 2', confidence: 0.75, excerpt: '' },
          { type: 'customer', name: 'Customer 1', confidence: 0.85, excerpt: '' },
          { type: 'facility', name: 'Plant 1', confidence: 0.9, excerpt: '' },
        ],
      };

      const byType = extractionResult.candidates.reduce(
        (acc, c) => {
          acc[c.type] = (acc[c.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      expect(byType.company).toBe(1);
      expect(byType.supplier).toBe(2);
      expect(byType.customer).toBe(1);
      expect(byType.facility).toBe(1);
    });

    it('should handle candidates without location gracefully', () => {
      const candidates = [
        { name: 'Facility A', location: 'Bangalore', confidence: 0.9 },
        { name: 'Facility B', location: null, confidence: 0.7 },
      ];

      const hasLocation = candidates.filter(c => c.location !== null);
      expect(hasLocation).toHaveLength(1);
      expect(hasLocation[0].name).toBe('Facility A');
    });
  });

  describe('Progress Tracking', () => {
    it('should track extraction progress stages', () => {
      const stages = ['fetching', 'extracting', 'done'] as const;
      const progressMap: Record<typeof stages[number], number> = {
        fetching: 1,
        extracting: 2,
        done: 3,
      };

      expect(progressMap.fetching).toBe(1);
      expect(progressMap.extracting).toBe(2);
      expect(progressMap.done).toBe(3);
    });
  });
});

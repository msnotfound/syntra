import { getDisruptionFactor, computeVarUsd } from '../../../packages/shared/utils/var-table';

describe('VaR computation — 4 cases', () => {

  test('1. Tier-1 small supplier × Critical physical_risk', () => {
    // Tier-1 supplier: $1M annual revenue, 10% contribution, critical physical_risk event.
    // Expected: 1_000_000 × 0.10 × 0.35 = 35_000
    const factor = getDisruptionFactor('physical_risk', 'critical');
    expect(factor).toBe(0.35);
    const varUsd = computeVarUsd(1_000_000, 10, factor);
    expect(varUsd).toBeCloseTo(35_000);
  });

  test('2. Tier-2 large supplier × Medium physical_risk', () => {
    // Tier-2 supplier: $50M annual revenue, 5% contribution, medium physical_risk event.
    // Expected: 50_000_000 × 0.05 × 0.12 = 300_000
    const factor = getDisruptionFactor('physical_risk', 'medium');
    expect(factor).toBe(0.12);
    const varUsd = computeVarUsd(50_000_000, 5, factor);
    expect(varUsd).toBeCloseTo(300_000);
  });

  test('3. sanctions_match uses highest disruption factor (critical = 0.90)', () => {
    // Sanctions designation on a key supplier: $5M revenue, 20% contribution.
    // OFAC SDN designation effectively halts ~90% of exposed trade value.
    // Expected: 5_000_000 × 0.20 × 0.90 = 900_000
    const factor = getDisruptionFactor('sanctions_match', 'critical');
    expect(factor).toBe(0.90);

    // Verify 0.90 is the highest factor across all kinds and severities.
    const allFactors = (
      ['physical_risk', 'sanctions_match', 'compliance'] as const
    ).flatMap(kind =>
      (['critical', 'high', 'medium', 'low', 'info'] as const).map(sev =>
        getDisruptionFactor(kind, sev),
      ),
    );
    expect(factor).toBe(Math.max(...allFactors));

    const varUsd = computeVarUsd(5_000_000, 20, factor);
    expect(varUsd).toBeCloseTo(900_000);
  });

  test('4. zero annual_revenue → var_value = 0', () => {
    const factor = getDisruptionFactor('physical_risk', 'high');
    const varUsd = computeVarUsd(0, 50, factor);
    expect(varUsd).toBe(0);
  });

});

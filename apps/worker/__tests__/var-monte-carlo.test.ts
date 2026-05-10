import {
  drawTriangular,
  getDisruptionDistribution,
  simulatePortfolioVarMonteCarlo,
  simulateVarMonteCarlo,
} from '../../../packages/shared/utils/var-monte-carlo';

function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('VaR Monte Carlo simulation — 4 cases', () => {
  test('1. single exposure normal case produces stable percentile bands and stats', () => {
    const distribution = getDisruptionDistribution('physical_risk', 'critical');
    const baseExposureUsd = 1_000_000 * 0.1;

    const result = simulateVarMonteCarlo({
      annualRevenueUsd: 1_000_000,
      contributionPct: 10,
      kind: 'physical_risk',
      severity: 'critical',
      iterations: 10_000,
      rng: lcg(42),
    });

    expect(drawTriangular({ min: 0.25, mode: 0.5, max: 0.75 }, () => 0)).toBeCloseTo(0.25);
    expect(drawTriangular({ min: 0.25, mode: 0.5, max: 0.75 }, () => 0.5)).toBeCloseTo(0.5);
    expect(drawTriangular({ min: 0.25, mode: 0.5, max: 0.75 }, () => 1)).toBeCloseTo(0.75);
    expect(result.var_at_75).toBeCloseTo(baseExposureUsd * 0.356_70, -2);
    expect(result.var_at_95).toBeGreaterThan(result.var_at_75);
    expect(result.var_at_99).toBeGreaterThan(result.var_at_95);
    expect(result.var_at_99).toBeLessThanOrEqual(baseExposureUsd * distribution.max);
    expect(result.expected_loss_usd).toBeCloseTo(
      baseExposureUsd * ((distribution.min + distribution.mode + distribution.max) / 3),
      -2,
    );
    expect(result.std_dev_usd).toBeGreaterThan(0);
    expect(result.iterations).toBe(10_000);
  });

  test('2. two exposures use correlated draws at rho 0.8', () => {
    const exposures = [
      {
        id: 'supplier-a',
        annualRevenueUsd: 1_000_000,
        contributionPct: 10,
        kind: 'physical_risk' as const,
        severity: 'high' as const,
      },
      {
        id: 'supplier-b',
        annualRevenueUsd: 2_000_000,
        contributionPct: 12,
        kind: 'physical_risk' as const,
        severity: 'high' as const,
      },
    ];
    const result = simulatePortfolioVarMonteCarlo({
      exposures,
      iterations: 10_000,
      correlation: 0.8,
      rng: lcg(7),
    });
    const independent = simulatePortfolioVarMonteCarlo({
      exposures,
      iterations: 10_000,
      correlation: 0,
      rng: lcg(7),
    });

    expect(result.exposures).toHaveLength(2);
    expect(result.loss_correlation).toBeCloseTo(0.8, 1);
    expect(result.portfolio.var_at_99).toBeGreaterThan(result.portfolio.var_at_95);
    expect(result.portfolio.var_at_95).toBeGreaterThan(independent.portfolio.var_at_95);
  });

  test('3. heavy-tail distribution produces a fatter upper band than triangular baseline', () => {
    const baseline = simulateVarMonteCarlo({
      annualRevenueUsd: 5_000_000,
      contributionPct: 20,
      kind: 'sanctions_match',
      severity: 'high',
      iterations: 10_000,
      rng: lcg(99),
    });

    const heavyTail = simulateVarMonteCarlo({
      annualRevenueUsd: 5_000_000,
      contributionPct: 20,
      kind: 'sanctions_match',
      severity: 'high',
      iterations: 10_000,
      distributionShape: 'fat_tail',
      rng: lcg(99),
    });

    expect(heavyTail.var_at_75).toBeGreaterThan(0);
    expect(heavyTail.var_at_95).toBeGreaterThanOrEqual(heavyTail.var_at_75);
    expect(heavyTail.var_at_99).toBeGreaterThanOrEqual(heavyTail.var_at_95);
    expect(heavyTail.var_at_99).toBeGreaterThan(baseline.var_at_99);
    expect(heavyTail.std_dev_usd).toBeGreaterThan(baseline.std_dev_usd);
  });

  test('4. all-zero exposures return zero bands and finite stats', () => {
    const result = simulatePortfolioVarMonteCarlo({
      exposures: [
        {
          id: 'zero-a',
          annualRevenueUsd: 0,
          contributionPct: 25,
          kind: 'compliance',
          severity: 'high',
        },
        {
          id: 'zero-b',
          annualRevenueUsd: 1_000_000,
          contributionPct: 0,
          kind: 'physical_risk',
          severity: 'critical',
        },
      ],
      iterations: 100,
      correlation: 0.8,
      rng: sequenceRng([0.1, 0.5, 0.9]),
    });

    expect(result.portfolio.var_at_75).toBe(0);
    expect(result.portfolio.var_at_95).toBe(0);
    expect(result.portfolio.var_at_99).toBe(0);
    expect(result.portfolio.expected_loss_usd).toBe(0);
    expect(result.portfolio.std_dev_usd).toBe(0);
    expect(result.loss_correlation).toBe(0);
    for (const exposure of result.exposures) {
      expect(exposure.var_at_75).toBe(0);
      expect(exposure.var_at_95).toBe(0);
      expect(exposure.var_at_99).toBe(0);
      expect(Number.isFinite(exposure.expected_loss_usd)).toBe(true);
      expect(Number.isFinite(exposure.std_dev_usd)).toBe(true);
    }
  });
});

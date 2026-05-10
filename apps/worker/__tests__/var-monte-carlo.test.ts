import {
  drawTriangular,
  getDisruptionDistribution,
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
  test('1. triangular draw maps min, mode, and max correctly', () => {
    const distribution = { min: 0.25, mode: 0.5, max: 0.75 };

    expect(drawTriangular(distribution, () => 0)).toBeCloseTo(0.25);
    expect(drawTriangular(distribution, () => 0.5)).toBeCloseTo(0.5);
    expect(drawTriangular(distribution, () => 1)).toBeCloseTo(0.75);
  });

  test('2. simulation with mode-only draws matches the fast estimate at every percentile', () => {
    const result = simulateVarMonteCarlo({
      annualRevenueUsd: 1_000_000,
      contributionPct: 10,
      kind: 'physical_risk',
      severity: 'critical',
      iterations: 100,
      rng: () => 0.5,
    });

    expect(result.var_at_75).toBeCloseTo(35_000);
    expect(result.var_at_95).toBeCloseTo(35_000);
    expect(result.var_at_99).toBeCloseTo(35_000);
    expect(result.iterations).toBe(100);
  });

  test('3. simulation returns zero percentiles when financial inputs are missing', () => {
    const result = simulateVarMonteCarlo({
      annualRevenueUsd: null,
      contributionPct: 25,
      kind: 'compliance',
      severity: 'high',
      iterations: 100,
      rng: sequenceRng([0.1, 0.5, 0.9]),
    });

    expect(result.var_at_75).toBe(0);
    expect(result.var_at_95).toBe(0);
    expect(result.var_at_99).toBe(0);
  });

  test('4. seeded sanctions simulation is ordered and bounded by its distribution', () => {
    const distribution = getDisruptionDistribution('sanctions_match', 'critical');
    const baseExposureUsd = 5_000_000 * 0.2;

    const result = simulateVarMonteCarlo({
      annualRevenueUsd: 5_000_000,
      contributionPct: 20,
      kind: 'sanctions_match',
      severity: 'critical',
      iterations: 10_000,
      rng: lcg(42),
    });

    expect(result.var_at_75).toBeGreaterThan(0);
    expect(result.var_at_95).toBeGreaterThanOrEqual(result.var_at_75);
    expect(result.var_at_99).toBeGreaterThanOrEqual(result.var_at_95);
    expect(result.var_at_75).toBeGreaterThanOrEqual(baseExposureUsd * distribution.min);
    expect(result.var_at_99).toBeLessThanOrEqual(baseExposureUsd * distribution.max);
  });
});

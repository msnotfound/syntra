import {
  getDisruptionFactor,
  type AlertKind,
  type AlertSeverity,
} from './var-table.js';

export interface TriangularDistribution {
  min: number;
  mode: number;
  max: number;
}

export type VarDistributionShape = 'triangular' | 'fat_tail';

export interface VarMonteCarloInput {
  id?: string;
  annualRevenueUsd: number | null;
  contributionPct: number | null;
  kind: AlertKind;
  severity: AlertSeverity;
  iterations?: number;
  rng?: () => number;
  distributionShape?: VarDistributionShape;
}

export interface VarMonteCarloResult {
  id?: string;
  var_at_75: number;
  var_at_95: number;
  var_at_99: number;
  expected_loss_usd: number;
  std_dev_usd: number;
  iterations: number;
  distribution: TriangularDistribution;
  distribution_shape: VarDistributionShape;
  methodology: string;
}

export interface VarMonteCarloExposureInput {
  id?: string;
  annualRevenueUsd: number | null;
  contributionPct: number | null;
  kind: AlertKind;
  severity: AlertSeverity;
  distributionShape?: VarDistributionShape;
}

export interface PortfolioLossBands {
  var_at_75: number;
  var_at_95: number;
  var_at_99: number;
  expected_loss_usd: number;
  std_dev_usd: number;
}

export interface VarMonteCarloPortfolioInput {
  exposures: VarMonteCarloExposureInput[];
  iterations?: number;
  rng?: () => number;
  correlation?: number;
}

export interface VarMonteCarloPortfolioResult {
  exposures: VarMonteCarloResult[];
  portfolio: PortfolioLossBands;
  iterations: number;
  correlation: number;
  loss_correlation: number;
  methodology: string;
}

const DEFAULT_ITERATIONS = 10_000;
const DEFAULT_CORRELATION = 0.35;

const DISTRIBUTION_BANDS: Record<AlertKind, Record<AlertSeverity, { min: number; max: number }>> = {
  physical_risk: {
    critical: { min: 0.25, max: 0.40 },
    high: { min: 0.15, max: 0.25 },
    medium: { min: 0.10, max: 0.15 },
    low: { min: 0.02, max: 0.07 },
    info: { min: 0.00, max: 0.02 },
  },
  sanctions_match: {
    critical: { min: 0.80, max: 0.95 },
    high: { min: 0.65, max: 0.85 },
    medium: { min: 0.40, max: 0.65 },
    low: { min: 0.20, max: 0.40 },
    info: { min: 0.02, max: 0.12 },
  },
  compliance: {
    critical: { min: 0.30, max: 0.50 },
    high: { min: 0.18, max: 0.32 },
    medium: { min: 0.08, max: 0.20 },
    low: { min: 0.02, max: 0.10 },
    info: { min: 0.00, max: 0.04 },
  },
};

export function getDisruptionDistribution(
  kind: AlertKind,
  severity: AlertSeverity,
): TriangularDistribution {
  const mode = getDisruptionFactor(kind, severity);
  const band = DISTRIBUTION_BANDS[kind]?.[severity];
  if (!band) return { min: mode, mode, max: mode };

  return {
    min: Math.min(band.min, mode),
    mode,
    max: Math.max(band.max, mode),
  };
}

export function drawTriangular(
  distribution: TriangularDistribution,
  rng: () => number = Math.random,
): number {
  const { min, mode, max } = distribution;
  if (min === max) return min;

  const u = Math.min(Math.max(rng(), 0), 1);
  const modeCutoff = (mode - min) / (max - min);

  if (u <= modeCutoff) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }

  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

export function simulateVarMonteCarlo(input: VarMonteCarloInput): VarMonteCarloResult {
  const result = simulatePortfolioVarMonteCarlo({
    exposures: [input],
    iterations: input.iterations,
    rng: input.rng,
    correlation: 0,
  });

  return result.exposures[0] ?? zeroExposureResult(input, result.iterations);
}

export function simulatePortfolioVarMonteCarlo(
  input: VarMonteCarloPortfolioInput,
): VarMonteCarloPortfolioResult {
  const iterations = Math.max(1, Math.floor(input.iterations ?? DEFAULT_ITERATIONS));
  const exposures = input.exposures.map((exposure) => ({
    ...exposure,
    distribution: getDisruptionDistribution(exposure.kind, exposure.severity),
    distributionShape: exposure.distributionShape ?? 'triangular',
    baseExposureUsd: getBaseExposureUsd(exposure.annualRevenueUsd, exposure.contributionPct),
  }));
  const correlation = clamp(input.correlation ?? DEFAULT_CORRELATION, 0, 0.999);
  const sqrtCorrelation = Math.sqrt(correlation);
  const sqrtIdiosyncratic = Math.sqrt(1 - correlation);
  const rng = input.rng ?? Math.random;
  const lossesByExposure = exposures.map((): number[] => []);
  const portfolioLosses: number[] = [];

  for (let i = 0; i < iterations; i += 1) {
    const commonShock = drawStandardNormal(rng);
    let portfolioLoss = 0;

    for (let exposureIndex = 0; exposureIndex < exposures.length; exposureIndex += 1) {
      const exposure = exposures[exposureIndex];
      const idiosyncraticShock = drawStandardNormal(rng);
      const correlatedShock =
        sqrtCorrelation * commonShock + sqrtIdiosyncratic * idiosyncraticShock;
      const disruptionFactor = drawDisruptionFactor(
        exposure.distribution,
        normalCdf(correlatedShock),
        exposure.distributionShape,
      );
      const loss = exposure.baseExposureUsd * disruptionFactor;

      lossesByExposure[exposureIndex].push(loss);
      portfolioLoss += loss;
    }

    portfolioLosses.push(portfolioLoss);
  }

  const exposureResults = exposures.map((exposure, index) => {
    const bands = summarizeLosses(lossesByExposure[index]);
    const methodology =
      `${iterations}-iteration Monte Carlo; ${exposure.distributionShape} disruption_factor` +
      `(${exposure.kind},${exposure.severity}) min=${exposure.distribution.min}, ` +
      `mode=${exposure.distribution.mode}, max=${exposure.distribution.max}; ` +
      `portfolio_correlation=${correlation}`;

    return {
      id: exposure.id,
      ...bands,
      iterations,
      distribution: exposure.distribution,
      distribution_shape: exposure.distributionShape,
      methodology,
    };
  });

  return {
    exposures: exposureResults,
    portfolio: summarizeLosses(portfolioLosses),
    iterations,
    correlation,
    loss_correlation: averagePairwiseCorrelation(lossesByExposure),
    methodology: `${iterations}-iteration correlated portfolio Monte Carlo; correlation=${correlation}`,
  };
}

function percentile(sortedValues: number[], p: number): number {
  const index = Math.min(sortedValues.length - 1, Math.ceil(p * sortedValues.length) - 1);
  return sortedValues[index] ?? 0;
}

function summarizeLosses(values: number[]): PortfolioLossBands {
  if (values.length === 0) {
    return {
      var_at_75: 0,
      var_at_95: 0,
      var_at_99: 0,
      expected_loss_usd: 0,
      std_dev_usd: 0,
    };
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => {
    const delta = value - mean;
    return sum + delta * delta;
  }, 0) / values.length;
  const sortedValues = [...values].sort((a, b) => a - b);

  return {
    var_at_75: percentile(sortedValues, 0.75),
    var_at_95: percentile(sortedValues, 0.95),
    var_at_99: percentile(sortedValues, 0.99),
    expected_loss_usd: mean,
    std_dev_usd: Math.sqrt(Math.max(variance, 0)),
  };
}

function getBaseExposureUsd(
  annualRevenueUsd: number | null,
  contributionPct: number | null,
): number {
  if (!annualRevenueUsd || !contributionPct) return 0;
  return annualRevenueUsd * (contributionPct / 100);
}

function drawDisruptionFactor(
  distribution: TriangularDistribution,
  u: number,
  shape: VarDistributionShape,
): number {
  if (shape === 'fat_tail') return drawFatTail(distribution, u);
  return drawTriangular(distribution, () => u);
}

function drawFatTail(distribution: TriangularDistribution, u: number): number {
  if (distribution.min === distribution.max) return distribution.min;

  const tailStart = 0.90;
  if (u < tailStart) {
    return drawTriangular(distribution, () => u / tailStart);
  }

  const tailU = (u - tailStart) / (1 - tailStart);
  const tailMax = Math.min(1, Math.max(distribution.max * 1.35, distribution.max + 0.10));
  const stretchedTail = 1 - Math.pow(1 - tailU, 3);
  return distribution.max + (tailMax - distribution.max) * stretchedTail;
}

function drawStandardNormal(rng: () => number): number {
  const u1 = Math.max(Number.EPSILON, Math.min(1 - Number.EPSILON, rng()));
  const u2 = Math.max(Number.EPSILON, Math.min(1 - Number.EPSILON, rng()));
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * absX);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
    - 0.284496736) * t + 0.254829592) * t * Math.exp(-absX * absX);
  return 0.5 * (1 + sign * erf);
}

function averagePairwiseCorrelation(lossesByExposure: number[][]): number {
  if (lossesByExposure.length < 2) return 0;

  let total = 0;
  let count = 0;
  for (let i = 0; i < lossesByExposure.length; i += 1) {
    for (let j = i + 1; j < lossesByExposure.length; j += 1) {
      const correlation = pearsonCorrelation(lossesByExposure[i], lossesByExposure[j]);
      if (Number.isFinite(correlation)) {
        total += correlation;
        count += 1;
      }
    }
  }

  return count > 0 ? total / count : 0;
}

function pearsonCorrelation(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const deltaA = a[i] - meanA;
    const deltaB = b[i] - meanB;
    covariance += deltaA * deltaB;
    varianceA += deltaA * deltaA;
    varianceB += deltaB * deltaB;
  }

  if (varianceA === 0 || varianceB === 0) return 0;
  return covariance / Math.sqrt(varianceA * varianceB);
}

function zeroExposureResult(input: VarMonteCarloInput, iterations: number): VarMonteCarloResult {
  const distribution = getDisruptionDistribution(input.kind, input.severity);

  return {
    id: input.id,
    var_at_75: 0,
    var_at_95: 0,
    var_at_99: 0,
    expected_loss_usd: 0,
    std_dev_usd: 0,
    iterations,
    distribution,
    distribution_shape: input.distributionShape ?? 'triangular',
    methodology: `${iterations}-iteration Monte Carlo; no exposure base`,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

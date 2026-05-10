import {
  computeVarUsd,
  getDisruptionFactor,
  type AlertKind,
  type AlertSeverity,
} from './var-table.js';

export interface TriangularDistribution {
  min: number;
  mode: number;
  max: number;
}

export interface VarMonteCarloInput {
  annualRevenueUsd: number | null;
  contributionPct: number | null;
  kind: AlertKind;
  severity: AlertSeverity;
  iterations?: number;
  rng?: () => number;
}

export interface VarMonteCarloResult {
  var_at_75: number;
  var_at_95: number;
  var_at_99: number;
  iterations: number;
  distribution: TriangularDistribution;
  methodology: string;
}

const DEFAULT_ITERATIONS = 10_000;

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
  const iterations = Math.max(1, Math.floor(input.iterations ?? DEFAULT_ITERATIONS));
  const distribution = getDisruptionDistribution(input.kind, input.severity);
  const methodology =
    `${iterations}-iteration Monte Carlo; triangular disruption_factor` +
    `(${input.kind},${input.severity}) min=${distribution.min}, mode=${distribution.mode}, max=${distribution.max}`;

  if (!input.annualRevenueUsd || !input.contributionPct) {
    return {
      var_at_75: 0,
      var_at_95: 0,
      var_at_99: 0,
      iterations,
      distribution,
      methodology,
    };
  }

  const values: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    values.push(
      computeVarUsd(
        input.annualRevenueUsd,
        input.contributionPct,
        drawTriangular(distribution, input.rng),
      ),
    );
  }

  values.sort((a, b) => a - b);

  return {
    var_at_75: percentile(values, 0.75),
    var_at_95: percentile(values, 0.95),
    var_at_99: percentile(values, 0.99),
    iterations,
    distribution,
    methodology,
  };
}

function percentile(sortedValues: number[], p: number): number {
  const index = Math.min(sortedValues.length - 1, Math.ceil(p * sortedValues.length) - 1);
  return sortedValues[index] ?? 0;
}

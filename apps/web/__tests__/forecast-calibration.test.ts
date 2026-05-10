import {
  aggregateCalibrationBins,
  computeRollingBrierSeries,
} from '../components/forecast/CalibrationDashboard';

const forecasts = [
  {
    id: 'f1',
    indicator_type: 'shipping-delay',
    probability_pct: 20,
    actual_outcome: 'did_not_occur' as const,
    brier_score: 0.04,
    expires_at: new Date('2026-01-01T00:00:00.000Z'),
  },
  {
    id: 'f2',
    indicator_type: 'shipping-delay',
    probability_pct: 25,
    actual_outcome: 'occurred' as const,
    brier_score: 0.5625,
    expires_at: new Date('2026-01-10T00:00:00.000Z'),
  },
  {
    id: 'f3',
    indicator_type: 'shipping-delay',
    probability_pct: 70,
    actual_outcome: 'occurred' as const,
    brier_score: 0.09,
    expires_at: new Date('2026-02-01T00:00:00.000Z'),
  },
  {
    id: 'f4',
    indicator_type: 'port-congestion',
    probability_pct: 80,
    actual_outcome: 'occurred' as const,
    brier_score: 0.04,
    expires_at: new Date('2026-02-05T00:00:00.000Z'),
  },
];

describe('forecast calibration aggregation', () => {
  it('bins predicted probabilities and computes observed outcome rate', () => {
    const bins = aggregateCalibrationBins(forecasts);

    expect(bins).toEqual([
      {
        bin: '20-29%',
        predictedMidpoint: 25,
        forecastCount: 2,
        actualOutcomeRate: 50,
      },
      {
        bin: '70-79%',
        predictedMidpoint: 75,
        forecastCount: 1,
        actualOutcomeRate: 100,
      },
      {
        bin: '80-89%',
        predictedMidpoint: 85,
        forecastCount: 1,
        actualOutcomeRate: 100,
      },
    ]);
  });

  it('computes rolling 30-day Brier score by indicator type', () => {
    const series = computeRollingBrierSeries(forecasts, 30);

    expect(series['shipping-delay']).toEqual([
      { date: '2026-01-01', rollingBrier: 0.04, forecastCount: 1 },
      { date: '2026-01-10', rollingBrier: 0.30125, forecastCount: 2 },
      { date: '2026-02-01', rollingBrier: 0.09, forecastCount: 1 },
    ]);
    expect(series['port-congestion']).toEqual([
      { date: '2026-02-05', rollingBrier: 0.04, forecastCount: 1 },
    ]);
  });
});

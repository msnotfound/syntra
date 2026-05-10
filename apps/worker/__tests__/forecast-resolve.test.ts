import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { Forecast } from '../../../packages/db/models/Forecast';
import { Alert } from '../../../packages/db/models/Alert';
import { computeBrierScore, runForecastResolveCycle } from '../src/workers/forecast-resolve';

jest.mock('../../../packages/db/connection', () => ({
  connectDb:    jest.fn().mockResolvedValue(undefined),
  disconnectDb: jest.fn().mockResolvedValue(undefined),
}));

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Forecast.deleteMany({});
  await Alert.deleteMany({});
});

const ORG = new Types.ObjectId();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeForecast(opts: {
  indicator_type?: string;
  probability_pct?: number;
  computed_at?: Date;
  expires_at?: Date;
  actual_outcome?: null;
}) {
  return Forecast.create({
    org_id:             ORG,
    indicator_id:       new Types.ObjectId(),
    indicator_type:     opts.indicator_type ?? 'port-congestion',
    target_entity_id:   null,
    probability_pct:    opts.probability_pct ?? 60,
    time_horizon_days:  14,
    supporting_claims:  [],
    narrative:          'Test narrative',
    recommended_action: 'Test action',
    computed_at:        opts.computed_at ?? new Date(Date.now() - 15 * 86400_000),
    expires_at:         opts.expires_at   ?? new Date(Date.now() -  1 * 86400_000),
    methodology:        'Test methodology',
    actual_outcome:     null,
    brier_score:        null,
  });
}

async function makeAlert(eventType: string, createdAt: Date) {
  return Alert.create({
    org_id:              ORG,
    event_id:            new Types.ObjectId(),
    watchlist_entity_ids: [],
    severity:            'high',
    subtype:             'physical_risk',
    match_reasons:       ['country'],
    event_snapshot: {
      title:       'Test event',
      description: 'Test',
      location:    { lat: 0, lng: 0 },
      country:     'IN',
      country_code: 'IN',
      event_type:  eventType,
      occurred_at: createdAt,
      sources:     [],
    },
    llm_context: { why_matters: null, recommended_actions: [] },
    status:               'open',
    assignee_user_id:     null,
    comments:             [],
  });
}

// ---------------------------------------------------------------------------
// Outcome resolution
// ---------------------------------------------------------------------------

describe('runForecastResolveCycle — outcome resolution', () => {
  it('resolves as "occurred" when matching alert exists in window', async () => {
    const computedAt = new Date(Date.now() - 15 * 86400_000);
    const expiresAt  = new Date(Date.now() -  1 * 86400_000);
    await makeForecast({ indicator_type: 'port-congestion', probability_pct: 65, computed_at: computedAt, expires_at: expiresAt });

    // Alert with 'port' keyword in event_type, created within forecast window
    await makeAlert('port blockage incident', new Date(Date.now() - 7 * 86400_000));

    const result = await runForecastResolveCycle();
    expect(result.resolved).toBe(1);

    const doc = await Forecast.findOne({ org_id: ORG }).lean();
    expect(doc?.actual_outcome).toBe('occurred');
    // Brier: (0.65 - 1)^2 = 0.1225
    expect(doc?.brier_score).toBeCloseTo(0.1225);
  });

  it('resolves as "did_not_occur" when no matching alert', async () => {
    await makeForecast({ indicator_type: 'sanctions-likelihood', probability_pct: 40 });

    const result = await runForecastResolveCycle();
    expect(result.resolved).toBe(1);

    const doc = await Forecast.findOne({ org_id: ORG }).lean();
    expect(doc?.actual_outcome).toBe('did_not_occur');
    // Brier: (0.40 - 0)^2 = 0.16
    expect(doc?.brier_score).toBeCloseTo(0.16);
  });

  it('does not resolve forecasts that have not yet expired', async () => {
    await Forecast.create({
      org_id:             ORG,
      indicator_id:       new Types.ObjectId(),
      indicator_type:     'currency-shock',
      target_entity_id:   null,
      probability_pct:    50,
      time_horizon_days:  30,
      supporting_claims:  [],
      narrative:          'Still active',
      recommended_action: 'Wait and watch',
      computed_at:        new Date(Date.now() - 3 * 86400_000),
      expires_at:         new Date(Date.now() + 27 * 86400_000), // not yet expired
      methodology:        'Test',
      actual_outcome:     null,
      brier_score:        null,
    });

    const result = await runForecastResolveCycle();
    expect(result.resolved).toBe(0);

    const doc = await Forecast.findOne({ org_id: ORG }).lean();
    expect(doc?.actual_outcome).toBeNull();
  });

  it('skips already-resolved forecasts', async () => {
    await Forecast.create({
      org_id:             ORG,
      indicator_id:       new Types.ObjectId(),
      indicator_type:     'shipping-delay',
      target_entity_id:   null,
      probability_pct:    70,
      time_horizon_days:  14,
      supporting_claims:  [],
      narrative:          'Already resolved',
      recommended_action: 'Done',
      computed_at:        new Date(Date.now() - 20 * 86400_000),
      expires_at:         new Date(Date.now() -  6 * 86400_000),
      methodology:        'Test',
      actual_outcome:     'occurred', // already resolved
      brier_score:        computeBrierScore(70, true),
    });

    const result = await runForecastResolveCycle();
    expect(result.resolved).toBe(0);
  });

  it('resolves multiple forecasts in a single cycle', async () => {
    const com = new Date(Date.now() - 15 * 86400_000);
    const exp = new Date(Date.now() -  1 * 86400_000);
    await makeForecast({ indicator_type: 'port-congestion',      probability_pct: 60, computed_at: com, expires_at: exp });
    await makeForecast({ indicator_type: 'sanctions-likelihood', probability_pct: 45, computed_at: com, expires_at: exp });

    const result = await runForecastResolveCycle();
    expect(result.resolved).toBe(2);
  });

  it('alert outside forecast window does not count as occurrence', async () => {
    const computedAt = new Date(Date.now() - 15 * 86400_000);
    const expiresAt  = new Date(Date.now() -  1 * 86400_000);
    await makeForecast({ indicator_type: 'port-congestion', probability_pct: 70, computed_at: computedAt, expires_at: expiresAt });

    // Alert created BEFORE forecast window (before computed_at)
    await makeAlert('port congestion alert', new Date(Date.now() - 20 * 86400_000));

    await runForecastResolveCycle();

    const doc = await Forecast.findOne({ org_id: ORG }).lean();
    // Alert was before computedAt, so did_not_occur within the window
    expect(doc?.actual_outcome).toBe('did_not_occur');
  });
});

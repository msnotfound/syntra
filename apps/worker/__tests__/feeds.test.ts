/**
 * @file feeds.test.ts
 * Tests for M33 open-data feed providers.
 * Covers: normalization, mock-mode fallback, cost gate enforcement.
 */

import { WeatherNoaaProvider } from '../../../packages/feeds/providers/weather-noaa';
import { TariffsWtoProvider } from '../../../packages/feeds/providers/tariffs-wto';
import { RegulatoryFdaProvider } from '../../../packages/feeds/providers/regulatory-fda';
import { SanctionsOfacProvider } from '../../../packages/feeds/providers/sanctions-ofac';
import { MaritimeImoProvider } from '../../../packages/feeds/providers/maritime-imo';
import { CurrencyEcbProvider, SIGNIFICANT_MOVE_PCT } from '../../../packages/feeds/providers/currency-ecb';
import { withCostGate, FeedCapExceededError } from '../../../packages/feeds/withCostGate';

// ---------------------------------------------------------------------------
// Weather NOAA provider
// ---------------------------------------------------------------------------

describe('WeatherNoaaProvider', () => {
  const provider = new WeatherNoaaProvider();

  test('getMockData returns 5+ events', () => {
    const events = provider.getMockData({});
    expect(events.length).toBeGreaterThanOrEqual(5);
  });

  test('each mock event has required fields', () => {
    const events = provider.getMockData({});
    for (const ev of events) {
      expect(ev.title).toBeTruthy();
      expect(ev.description).toBeTruthy();
      expect(ev.phenomenon).toBeTruthy();
      expect(['extreme', 'severe', 'moderate', 'minor']).toContain(ev.severity_level);
      expect(typeof ev.latitude).toBe('number');
      expect(typeof ev.longitude).toBe('number');
      expect(ev.country_code).toMatch(/^[A-Z]{2}$/);
      expect(ev.occurred_at).toBeInstanceOf(Date);
      expect(ev.source_url).toMatch(/^https?:\/\//);
    }
  });

  test('fetch() returns mock data when NOAA_API_KEY is absent', async () => {
    delete process.env.NOAA_API_KEY;
    const result = await provider.fetch({}, { org_id: 'test-org' });
    expect(result.length).toBeGreaterThanOrEqual(5);
  });

  test('estimateCost is always 0 (free provider)', () => {
    expect(provider.estimateCost({})).toBe(0);
  });

  test('withCostGate returns same instance for free provider', () => {
    const gated = provider.withCostGate({ org_id: 'org1', cap_inr_daily: 100 });
    expect(gated).toBe(provider);
  });
});

// ---------------------------------------------------------------------------
// Tariffs WTO provider
// ---------------------------------------------------------------------------

describe('TariffsWtoProvider', () => {
  const provider = new TariffsWtoProvider();

  test('getMockData returns 5+ tariff changes', () => {
    const changes = provider.getMockData({});
    expect(changes.length).toBeGreaterThanOrEqual(5);
  });

  test('each tariff change has valid fields', () => {
    const changes = provider.getMockData({});
    for (const ch of changes) {
      expect(ch.title).toBeTruthy();
      expect(ch.description).toBeTruthy();
      expect(ch.hs_code).toBeTruthy();
      expect(['increase', 'decrease', 'new', 'abolished']).toContain(ch.change_type);
      expect(typeof ch.new_rate_pct).toBe('number');
      expect(ch.effective_from).toBeInstanceOf(Date);
    }
  });

  test('fetch() returns mock data when WTO_TARIFF_API_URL is absent', async () => {
    delete process.env.WTO_TARIFF_API_URL;
    const result = await provider.fetch({}, { org_id: 'test-org' });
    expect(result.length).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// Regulatory provider
// ---------------------------------------------------------------------------

describe('RegulatoryFdaProvider', () => {
  const provider = new RegulatoryFdaProvider();

  test('getMockData returns 5+ regulatory changes', () => {
    const changes = provider.getMockData({});
    expect(changes.length).toBeGreaterThanOrEqual(5);
  });

  test('each regulatory change has valid fields', () => {
    const changes = provider.getMockData({});
    const validCategories = ['export_control', 'import_ban', 'sanctions', 'environmental', 'labor', 'data_privacy', 'other'];
    for (const ch of changes) {
      expect(ch.title).toBeTruthy();
      expect(ch.summary).toBeTruthy();
      expect(validCategories).toContain(ch.category);
      expect(ch.effective_date).toBeInstanceOf(Date);
      expect(Array.isArray(ch.affects_industries)).toBe(true);
    }
  });

  test('fetch() returns mock data when FEDERAL_REGISTER_API_KEY is absent', async () => {
    delete process.env.FEDERAL_REGISTER_API_KEY;
    const result = await provider.fetch({}, { org_id: 'test-org' });
    expect(result.length).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// Sanctions OFAC provider (additive update events)
// ---------------------------------------------------------------------------

describe('SanctionsOfacProvider', () => {
  const provider = new SanctionsOfacProvider();

  test('getMockData returns 5+ update events', () => {
    const events = provider.getMockData({});
    expect(events.length).toBeGreaterThanOrEqual(5);
  });

  test('each update event has valid fields', () => {
    const events = provider.getMockData({});
    for (const ev of events) {
      expect(ev.title).toBeTruthy();
      expect(ev.description).toBeTruthy();
      expect(ev.list_name).toBeTruthy();
      expect(typeof ev.new_entries_count).toBe('number');
      expect(typeof ev.removed_entries_count).toBe('number');
      expect(ev.occurred_at).toBeInstanceOf(Date);
      expect(Array.isArray(ev.programs_affected)).toBe(true);
    }
  });

  test('fetch() returns mock data when OFAC_FEED_URL is absent', async () => {
    delete process.env.OFAC_FEED_URL;
    const result = await provider.fetch({}, { org_id: 'test-org' });
    expect(result.length).toBeGreaterThanOrEqual(5);
  });

  test('id is distinct from M17 ofac-sanctions provider', () => {
    expect(provider.id).toBe('sanctions-ofac');
    expect(provider.id).not.toBe('ofac-sanctions');
  });
});

// ---------------------------------------------------------------------------
// Maritime IMO provider
// ---------------------------------------------------------------------------

describe('MaritimeImoProvider', () => {
  const provider = new MaritimeImoProvider();

  test('getMockData returns 5+ advisories', () => {
    const advisories = provider.getMockData({});
    expect(advisories.length).toBeGreaterThanOrEqual(5);
  });

  test('each advisory has valid fields', () => {
    const advisories = provider.getMockData({});
    const validSeverities = ['high', 'medium', 'low'];
    for (const adv of advisories) {
      expect(adv.title).toBeTruthy();
      expect(adv.description).toBeTruthy();
      expect(validSeverities).toContain(adv.severity_level);
      expect(typeof adv.latitude).toBe('number');
      expect(typeof adv.longitude).toBe('number');
      expect(adv.country_code).toMatch(/^[A-Z]{2}$/);
      expect(adv.occurred_at).toBeInstanceOf(Date);
    }
  });

  test('fetch() returns mock data when IMO_MSI_API_KEY is absent', async () => {
    delete process.env.IMO_MSI_API_KEY;
    const result = await provider.fetch({}, { org_id: 'test-org' });
    expect(result.length).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// Currency ECB provider
// ---------------------------------------------------------------------------

describe('CurrencyEcbProvider', () => {
  const provider = new CurrencyEcbProvider();

  test('getMockData returns 5+ rates', () => {
    const rates = provider.getMockData({});
    expect(rates.length).toBeGreaterThanOrEqual(5);
  });

  test('each rate has valid fields', () => {
    const rates = provider.getMockData({});
    for (const rate of rates) {
      expect(rate.base_currency).toBeTruthy();
      expect(rate.target_currency).toBeTruthy();
      expect(typeof rate.rate).toBe('number');
      expect(rate.rate).toBeGreaterThan(0);
      expect(typeof rate.change_pct_24h).toBe('number');
      expect(rate.timestamp).toBeInstanceOf(Date);
    }
  });

  test('fetch() returns mock data when ECB_DATA_URL is absent', async () => {
    delete process.env.ECB_DATA_URL;
    const result = await provider.fetch({}, { org_id: 'test-org' });
    expect(result.length).toBeGreaterThanOrEqual(5);
  });

  test('SIGNIFICANT_MOVE_PCT is a positive number', () => {
    expect(SIGNIFICANT_MOVE_PCT).toBeGreaterThan(0);
  });

  test('mock data includes at least one rate exceeding SIGNIFICANT_MOVE_PCT', () => {
    const rates = provider.getMockData({});
    const significant = rates.filter(r => Math.abs(r.change_pct_24h) >= SIGNIFICANT_MOVE_PCT);
    expect(significant.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// withCostGate — cost gate enforcement
// ---------------------------------------------------------------------------

describe('withCostGate', () => {
  const mockPaidProvider = {
    id: 'mock-paid-provider',
    name: 'Mock Paid Provider',
    cost_model: 'paid' as const,
    cost_per_request_inr: 50,
    rate_limit: { requests_per_minute: 10, requests_per_day: 100 },
    fetch: jest.fn().mockResolvedValue(['data']),
    getMockData: jest.fn().mockReturnValue(['mock']),
    estimateCost: jest.fn().mockReturnValue(50),
    withCostGate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('free provider returns itself unchanged', () => {
    const freeProvider = new WeatherNoaaProvider();
    const gated = withCostGate(freeProvider, { org_id: 'org1', cap_inr_daily: 100 });
    expect(gated).toBe(freeProvider);
  });

  test('paid provider with sufficient cap allows fetch', async () => {
    mockPaidProvider.estimateCost.mockReturnValue(50);
    const gated = withCostGate(mockPaidProvider, { org_id: 'org-cap-test-allow', cap_inr_daily: 1000 });
    await gated.fetch({}, { org_id: 'org-cap-test-allow' });
    expect(mockPaidProvider.fetch).toHaveBeenCalledTimes(1);
  });

  test('paid provider throws FeedCapExceededError when cap is 0', async () => {
    const gated = withCostGate(mockPaidProvider, { org_id: 'org-cap-test-zero', cap_inr_daily: 0 });
    await expect(gated.fetch({}, { org_id: 'org-cap-test-zero' })).rejects.toThrow(FeedCapExceededError);
  });

  test('FeedCapExceededError carries provider_id and org_id', async () => {
    const gated = withCostGate(mockPaidProvider, { org_id: 'org-err-test', cap_inr_daily: 0 });
    try {
      await gated.fetch({}, { org_id: 'org-err-test' });
      fail('Expected FeedCapExceededError');
    } catch (err) {
      expect(err).toBeInstanceOf(FeedCapExceededError);
      if (err instanceof FeedCapExceededError) {
        expect(err.provider_id).toBe('mock-paid-provider');
        expect(err.org_id).toBe('org-err-test');
      }
    }
  });
});

import { connectDb, Event, DataFeed } from '@syntra/db';
import {
  weatherNoaaProvider,
  tariffsWtoProvider,
  regulatoryFdaProvider,
  sanctionsOfacProvider,
  maritimeImoProvider,
  currencyEcbProvider,
  SIGNIFICANT_MOVE_PCT,
} from '@syntra/feeds';
import type {
  WeatherEvent,
  TariffChange,
  RegulatoryChange,
  SanctionsUpdateEvent,
  MaritimeAdvisory,
  CurrencyRate,
} from '@syntra/feeds';

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

// ---------------------------------------------------------------------------
// Normalisers — each maps a provider-specific item to Event fields
// ---------------------------------------------------------------------------

function weatherSeverity(level: WeatherEvent['severity_level']): Severity {
  return level === 'extreme' ? 'critical' : level === 'severe' ? 'high' : level === 'moderate' ? 'medium' : 'low';
}

function maritimeSeverity(level: MaritimeAdvisory['severity_level']): Severity {
  return level === 'high' ? 'high' : level === 'medium' ? 'medium' : 'low';
}

function currencySeverity(changePct: number): Severity {
  const abs = Math.abs(changePct);
  return abs >= 5 ? 'high' : abs >= 2 ? 'medium' : 'info';
}

// ---------------------------------------------------------------------------
// Dedup helper — skip events already written by this title today
// ---------------------------------------------------------------------------

async function eventExistsByTitle(title: string): Promise<boolean> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const count = await Event.countDocuments({ title, created_at: { $gte: today } });
  return count > 0;
}

// ---------------------------------------------------------------------------
// Per-provider ingest functions
// ---------------------------------------------------------------------------

async function ingestWeather(): Promise<number> {
  const events = await weatherNoaaProvider.fetch({}, { org_id: 'system' });
  let created = 0;
  for (const item of events) {
    if (await eventExistsByTitle(item.title)) continue;
    await Event.create({
      title: item.title,
      description: item.description,
      location: { lat: item.latitude, lng: item.longitude },
      country: item.country,
      country_code: item.country_code,
      severity: weatherSeverity(item.severity_level),
      event_type: `weather_${item.phenomenon}`,
      sources: [{ url: item.source_url, name: 'NOAA National Weather Service' }],
      occurred_at: item.occurred_at,
    });
    created++;
  }
  return created;
}

async function ingestTariffs(): Promise<number> {
  const changes = await tariffsWtoProvider.fetch({}, { org_id: 'system' });
  let created = 0;
  for (const item of changes) {
    if (await eventExistsByTitle(item.title)) continue;
    await Event.create({
      title: item.title,
      description: item.description,
      location: { lat: 46.2, lng: 6.1 },  // WTO HQ, Geneva
      country: item.jurisdiction,
      country_code: item.country_code,
      severity: 'medium',
      event_type: `tariff_${item.change_type}`,
      sources: [{ url: item.source_url, name: 'WTO Tariff Download Facility' }],
      occurred_at: item.effective_from,
    });
    created++;
  }
  return created;
}

async function ingestRegulatory(): Promise<number> {
  const changes = await regulatoryFdaProvider.fetch({}, { org_id: 'system' });
  let created = 0;
  for (const item of changes) {
    if (await eventExistsByTitle(item.title)) continue;
    const severity: Severity = item.category === 'export_control' || item.category === 'import_ban' ? 'medium' : 'low';
    await Event.create({
      title: item.title,
      description: item.summary,
      location: { lat: 38.9, lng: -77.0 },  // Washington DC default
      country: item.jurisdiction,
      country_code: item.country_code,
      severity,
      event_type: `regulatory_${item.category}`,
      sources: [{ url: item.source_url, name: 'Regulatory Feed' }],
      occurred_at: item.effective_date,
    });
    created++;
  }
  return created;
}

async function ingestSanctionsUpdates(): Promise<number> {
  const updates = await sanctionsOfacProvider.fetch({}, { org_id: 'system' });
  let created = 0;
  for (const item of updates) {
    if (await eventExistsByTitle(item.title)) continue;
    await Event.create({
      title: item.title,
      description: item.description,
      location: { lat: 38.9, lng: -77.0 },  // OFAC / Washington DC
      country: 'United States',
      country_code: 'US',
      severity: 'medium',
      event_type: 'sanctions_update',
      sources: [{ url: item.source_url, name: 'OFAC SDN List' }],
      occurred_at: item.occurred_at,
    });
    created++;
  }
  return created;
}

async function ingestMaritime(): Promise<number> {
  const advisories = await maritimeImoProvider.fetch({}, { org_id: 'system' });
  let created = 0;
  for (const item of advisories) {
    if (await eventExistsByTitle(item.title)) continue;
    await Event.create({
      title: item.title,
      description: item.description,
      location: { lat: item.latitude, lng: item.longitude },
      country: item.country,
      country_code: item.country_code,
      severity: maritimeSeverity(item.severity_level),
      event_type: `maritime_${item.advisory_type}`,
      sources: [{ url: item.source_url, name: 'IMO Maritime Safety Information' }],
      occurred_at: item.occurred_at,
    });
    created++;
  }
  return created;
}

async function ingestCurrency(): Promise<number> {
  const rates = await currencyEcbProvider.fetch({}, { org_id: 'system' });
  let created = 0;
  for (const item of rates) {
    // Only emit events for significant currency moves
    if (Math.abs(item.change_pct_24h) < SIGNIFICANT_MOVE_PCT) continue;
    const direction = item.change_pct_24h > 0 ? 'strengthening' : 'weakening';
    const eventTitle = `ECB: ${item.target_currency}/${item.base_currency} ${direction} ${Math.abs(item.change_pct_24h).toFixed(1)}% in 24h`;
    if (await eventExistsByTitle(eventTitle)) continue;
    await Event.create({
      title: eventTitle,
      description:
        `The ${item.target_currency}/${item.base_currency} exchange rate moved ${item.change_pct_24h.toFixed(2)}% ` +
        `in the last 24 hours. Current rate: ${item.rate}. Significant currency volatility may affect export pricing and hedging positions.`,
      location: { lat: 50.1, lng: 8.7 },  // ECB HQ, Frankfurt
      country: 'European Union',
      country_code: 'EU',
      severity: currencySeverity(item.change_pct_24h),
      event_type: 'currency_move',
      sources: [{ url: item.source_url, name: 'ECB Euro Reference Exchange Rates' }],
      occurred_at: item.timestamp,
    });
    created++;
  }
  return created;
}

// ---------------------------------------------------------------------------
// DataFeed registry — upsert on startup + update after each poll
// ---------------------------------------------------------------------------

const FEED_REGISTRY = [
  { feed_id: 'weather-noaa', name: 'NOAA National Weather Service', provider: 'weather-noaa', cost_model: 'free' as const },
  { feed_id: 'tariffs-wto', name: 'WTO Tariff Download Facility', provider: 'tariffs-wto', cost_model: 'free' as const },
  { feed_id: 'regulatory-fda', name: 'Regulatory Feed (Federal Register / EUR-Lex)', provider: 'regulatory-fda', cost_model: 'free' as const },
  { feed_id: 'sanctions-ofac', name: 'OFAC Update Events', provider: 'sanctions-ofac', cost_model: 'free' as const },
  { feed_id: 'maritime-imo', name: 'IMO Maritime Safety Information', provider: 'maritime-imo', cost_model: 'free' as const },
  { feed_id: 'currency-ecb', name: 'ECB Euro Reference Exchange Rates', provider: 'currency-ecb', cost_model: 'free' as const },
];

async function ensureFeedRegistry(): Promise<void> {
  for (const feed of FEED_REGISTRY) {
    await DataFeed.findOneAndUpdate(
      { feed_id: feed.feed_id },
      { $setOnInsert: { ...feed, active: true } },
      { upsert: true },
    );
  }
}

async function updateFeedStatus(
  feed_id: string,
  status: 'ok' | 'degraded' | 'failed',
  eventsCreated: number,
): Promise<void> {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);

  const existing = await DataFeed.findOne({ feed_id });
  const isNewDay = !existing?.last_sync_at || existing.last_sync_at < dayStart;

  if (isNewDay) {
    await DataFeed.findOneAndUpdate(
      { feed_id },
      {
        last_sync_at: now,
        last_sync_status: status,
        event_count_24h: eventsCreated,
        $inc: { event_count_total: eventsCreated },
      },
    );
  } else {
    await DataFeed.findOneAndUpdate(
      { feed_id },
      {
        last_sync_at: now,
        last_sync_status: status,
        $inc: { event_count_total: eventsCreated, event_count_24h: eventsCreated },
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Main poll cycle — called every 15 minutes by the cron
// ---------------------------------------------------------------------------

export interface FeedsPollResult {
  weather: number;
  tariffs: number;
  regulatory: number;
  sanctions: number;
  maritime: number;
  currency: number;
  total: number;
}

export async function runFeedsPollCycle(): Promise<FeedsPollResult> {
  await connectDb();
  await ensureFeedRegistry();

  const results = {
    weather: 0,
    tariffs: 0,
    regulatory: 0,
    sanctions: 0,
    maritime: 0,
    currency: 0,
  };

  const jobs: Array<{
    key: keyof typeof results;
    feed_id: string;
    fn: () => Promise<number>;
  }> = [
    { key: 'weather', feed_id: 'weather-noaa', fn: ingestWeather },
    { key: 'tariffs', feed_id: 'tariffs-wto', fn: ingestTariffs },
    { key: 'regulatory', feed_id: 'regulatory-fda', fn: ingestRegulatory },
    { key: 'sanctions', feed_id: 'sanctions-ofac', fn: ingestSanctionsUpdates },
    { key: 'maritime', feed_id: 'maritime-imo', fn: ingestMaritime },
    { key: 'currency', feed_id: 'currency-ecb', fn: ingestCurrency },
  ];

  for (const job of jobs) {
    try {
      results[job.key] = await job.fn();
      await updateFeedStatus(job.feed_id, 'ok', results[job.key]);
    } catch (err) {
      console.error(`[feeds-poll:${job.key}] Error:`, err);
      await updateFeedStatus(job.feed_id, 'failed', 0);
    }
  }

  return {
    ...results,
    total: Object.values(results).reduce((sum, n) => sum + n, 0),
  };
}

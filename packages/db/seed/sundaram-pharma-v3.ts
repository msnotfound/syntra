import { Types } from 'mongoose';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { WatchlistEntity } from '../models/WatchlistEntity.js';
import { Alert } from '../models/Alert.js';
import { Exposure } from '../models/Exposure.js';
import { RiskScore } from '../models/RiskScore.js';
import { SupplierLink } from '../models/SupplierLink.js';
import { Scenario } from '../models/Scenario.js';
import { MitigationSuggestion } from '../models/MitigationSuggestion.js';
import { Forecast } from '../models/Forecast.js';
import { LeadingIndicator, INDICATOR_SEEDS } from '../models/LeadingIndicator.js';
import { IntelClaim } from '../models/IntelClaim.js';
import { SourceReliability } from '../models/SourceReliability.js';
import { Decision } from '../models/Decision.js';
import { WarRoom } from '../models/WarRoom.js';
import { WarRoomMessage } from '../models/WarRoomMessage.js';
import { Asset } from '../models/Asset.js';
import { Shipment } from '../models/Shipment.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { Counterparty } from '../models/Counterparty.js';
import { Contract } from '../models/Contract.js';
import { DigestPreference } from '../models/DigestPreference.js';
import { NotificationChannel } from '../models/NotificationChannel.js';
import { CustomSource } from '../models/CustomSource.js';
import { InsurancePolicy } from '../models/InsurancePolicy.js';
import { SeverityRule } from '../models/SeverityRule.js';
import { DataFeed } from '../models/DataFeed.js';
import { seedSundaramPharma } from './sundaram-pharma.js';

type SeedUser = {
  clerk_user_id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
};

type EntityDoc = {
  _id: Types.ObjectId;
  name: string;
  type: string;
  country_code: string | null;
};

type AlertDoc = {
  _id: Types.ObjectId;
  event_snapshot?: { title?: string };
};

type UserDoc = {
  _id: Types.ObjectId;
  email: string;
};

type PolicyDoc = {
  _id: Types.ObjectId;
  policy_id: string;
};

type SourceDoc = {
  _id: Types.ObjectId;
  source_id: string;
};

type IndicatorDoc = {
  _id: Types.ObjectId;
  name: string;
};

const USD_INR = 83;
const DAY_MS = 24 * 60 * 60 * 1000;

function dollars(value: number): number {
  return Math.round(value);
}

function daysFromNow(days: number, base = new Date()): Date {
  return new Date(base.getTime() + days * DAY_MS);
}

function objectId(id: unknown): Types.ObjectId {
  return id as Types.ObjectId;
}

function titleIncludes<T extends { event_snapshot?: { title?: string } }>(alerts: T[], text: string): T | undefined {
  return alerts.find(a => a.event_snapshot?.title?.includes(text));
}

async function ensureSeedUsers(orgId: Types.ObjectId) {
  const users: SeedUser[] = [
    { clerk_user_id: 'user_mock_priya', email: 'priya@sundarampharma.com', name: 'Priya Mehta', role: 'owner' },
    { clerk_user_id: 'user_mock_arjun', email: 'arjun@sundarampharma.com', name: 'Arjun Rao', role: 'admin' },
    { clerk_user_id: 'user_mock_nadia', email: 'nadia@sundarampharma.com', name: 'Nadia Fernandes', role: 'member' },
  ];

  for (const user of users) {
    await User.updateOne(
      { clerk_user_id: user.clerk_user_id },
      { $setOnInsert: { ...user, org_id: orgId } },
      { upsert: true },
    );
  }

  return User.find({ org_id: orgId, clerk_user_id: { $in: users.map(u => u.clerk_user_id) } }).sort({ role: 1 });
}

async function seedSourceReliabilityV3() {
  const assessedAt = new Date('2026-05-01T00:00:00.000Z');
  const sources = [
    { source_id: 'reuters', source_name: 'Reuters', admiralty_code: 'A', reliability_pct: 95 },
    { source_id: 'al-jazeera', source_name: 'Al Jazeera', admiralty_code: 'B', reliability_pct: 78 },
    { source_id: 'lloyds-list', source_name: "Lloyd's List", admiralty_code: 'B', reliability_pct: 82 },
    { source_id: 'gdelt', source_name: 'GDELT Project', admiralty_code: 'C', reliability_pct: 60 },
    { source_id: 'local-news', source_name: 'Local Maharashtra Newsdesk', admiralty_code: 'D', reliability_pct: 42 },
    { source_id: 'social-media', source_name: 'Social Media', admiralty_code: 'E', reliability_pct: 20 },
  ] as const;

  for (const source of sources) {
    await SourceReliability.updateOne(
      { source_id: source.source_id },
      { $set: { ...source, last_assessed_at: assessedAt } },
      { upsert: true },
    );
  }
  console.log('[seed] Source reliability: done');
}

async function seedLeadingIndicatorsV3(now: Date) {
  const metrics = [
    { name: 'port-call-rate-anomaly', current_value: 0.72, baseline_value: 0.34, sigma: 0.15, threshold_breach: 'critical', trend: 'rising' },
    { name: 'sanctions-list-velocity', current_value: 0.41, baseline_value: 0.23, sigma: 0.12, threshold_breach: 'elevated', trend: 'rising' },
    { name: 'shipping-deviation-frequency', current_value: 0.66, baseline_value: 0.29, sigma: 0.14, threshold_breach: 'critical', trend: 'rising' },
    { name: 'currency-volatility', current_value: 0.58, baseline_value: 0.37, sigma: 0.11, threshold_breach: 'elevated', trend: 'rising' },
    { name: 'commodity-price-spike', current_value: 0.49, baseline_value: 0.31, sigma: 0.10, threshold_breach: 'elevated', trend: 'stable' },
    { name: 'regulatory-mention-frequency', current_value: 0.44, baseline_value: 0.28, sigma: 0.09, threshold_breach: 'elevated', trend: 'rising' },
    { name: 'vessel-position-anomaly', current_value: 0.63, baseline_value: 0.25, sigma: 0.13, threshold_breach: 'critical', trend: 'rising' },
    { name: 'supplier-news-velocity', current_value: 0.36, baseline_value: 0.22, sigma: 0.08, threshold_breach: 'elevated', trend: 'stable' },
  ] as const;

  for (const seed of INDICATOR_SEEDS) {
    const metric = metrics.find(m => m.name === seed.name);
    await LeadingIndicator.updateOne(
      { name: seed.name },
      {
        $set: {
          ...seed,
          current_value: metric?.current_value ?? 0,
          baseline_value: metric?.baseline_value ?? 0,
          sigma: metric?.sigma ?? 0,
          computed_at: now,
          threshold_breach: metric?.threshold_breach ?? 'normal',
          trend: metric?.trend ?? 'stable',
        },
      },
      { upsert: true },
    );
  }
  console.log('[seed] Leading indicators: done');
}

async function seedInsurancePolicies(orgId: Types.ObjectId, now: Date) {
  const policies = [
    { policy_id: 'SP-MAR-2026-001', insurer_name: 'New India Assurance', coverage_type: 'marine', max_payout_usd: 4_500_000, deductible_usd: 75_000, expires_at: daysFromNow(260, now) },
    { policy_id: 'SP-CGO-2026-002', insurer_name: 'ICICI Lombard', coverage_type: 'cargo', max_payout_usd: 2_800_000, deductible_usd: 40_000, expires_at: daysFromNow(190, now) },
    { policy_id: 'SP-TCR-2026-003', insurer_name: 'ECGC India', coverage_type: 'trade_credit', max_payout_usd: 3_200_000, deductible_usd: 50_000, expires_at: daysFromNow(310, now) },
    { policy_id: 'SP-PRI-2026-004', insurer_name: 'Zurich Political Risk', coverage_type: 'political_risk', max_payout_usd: 5_000_000, deductible_usd: 125_000, expires_at: daysFromNow(220, now) },
  ] as const;

  for (const policy of policies) {
    await InsurancePolicy.updateOne({ org_id: orgId, policy_id: policy.policy_id }, { $set: policy }, { upsert: true });
  }
  console.log('[seed] Insurance policies: done');
  return InsurancePolicy.find({ org_id: orgId }).sort({ policy_id: 1 });
}

async function seedExposures(
  orgId: Types.ObjectId,
  entities: EntityDoc[],
  alerts: AlertDoc[],
  policies: PolicyDoc[],
  now: Date,
) {
  await Exposure.deleteMany({ org_id: orgId });
  const entityByName = new Map(entities.map(e => [e.name, e]));
  const criticalAlert = titleIncludes(alerts, 'Galaxy Leader') ?? alerts[0];
  const mombasaAlert = titleIncludes(alerts, 'Mombasa') ?? alerts[1] ?? alerts[0];
  const cycloneAlert = titleIncludes(alerts, 'Cyclone') ?? alerts[2] ?? alerts[0];
  const defs = [
    ['India → East Africa via Suez', criticalAlert, 4_850_000, 78, 'SP-MAR-2026-001', 460_000],
    ['JNPT (Jawaharlal Nehru Port)', criticalAlert, 1_250_000, 65, 'SP-CGO-2026-002', 180_000],
    ['Mundra Port', criticalAlert, 690_000, 55, 'SP-CGO-2026-002', 90_000],
    ['Kenya', mombasaAlert, 2_150_000, 72, 'SP-TCR-2026-003', 310_000],
    ['Nigeria', titleIncludes(alerts, 'Apapa') ?? mombasaAlert, 1_700_000, 61, 'SP-TCR-2026-003', 220_000],
    ['Chennai Port', cycloneAlert, 520_000, 48, 'SP-CGO-2026-002', 130_000],
    ['Cipla Goa Plant', cycloneAlert, 350_000, 35, 'SP-CGO-2026-002', 75_000],
    ['Dubai Distribution Hub', titleIncludes(alerts, 'OFAC') ?? criticalAlert, 980_000, 82, 'SP-PRI-2026-004', 40_000],
    ['Nairobi Distribution Warehouse', mombasaAlert, 2_800_000, 70, 'SP-TCR-2026-003', 260_000],
    ['Tanzania', mombasaAlert, 95_000, 25, null, 18_000],
  ] as const;

  await Exposure.insertMany(defs.flatMap(([entityName, alert, varUsd, coveragePct, policyId, delta], idx) => {
    const entity = entityByName.get(entityName);
    if (!entity) return [];
    const coverageGap = dollars(varUsd * (1 - coveragePct / 100));
    return [{
      org_id: orgId,
      entity_id: objectId(entity._id),
      alert_id: alert ? objectId(alert._id) : null,
      var_value_usd: varUsd,
      var_value_inr: dollars(varUsd * USD_INR),
      confidence_interval: 0.68 + idx * 0.02,
      methodology: 'Seeded Monte Carlo VaR using shipment value, entity criticality, current alert severity, and insurance policy offsets.',
      computed_at: new Date(now.getTime() - idx * 35 * 60 * 1000),
      insurance_coverage_pct: coveragePct,
      policy_id: policyId,
      coverage_gap_usd: coverageGap,
      exposure_delta_usd: delta,
    }];
  }));
  console.log('[seed] Exposures: done');
}

async function seedRiskScores(orgId: Types.ObjectId, entities: EntityDoc[], now: Date) {
  await RiskScore.deleteMany({ org_id: orgId });
  const focusNames = [
    'org-wide',
    'India → East Africa via Suez',
    'JNPT (Jawaharlal Nehru Port)',
    'Kenya',
    'Chennai Port',
  ];
  const scores = [];
  for (let day = 29; day >= 0; day -= 1) {
    for (let focusIdx = 0; focusIdx < focusNames.length; focusIdx += 1) {
      const focus = focusNames[focusIdx];
      const alertSpike = day <= 3 || day === 7 || day === 12;
      const baseScore = 34 + ((day + focusIdx * 4) % 19);
      const spikeBoost = alertSpike ? (focusIdx === 1 ? 27 : 14 + focusIdx * 2) : 0;
      const score = Math.min(88, baseScore + spikeBoost);
      const entity = entities.find(e => e.name === focus);
      scores.push({
        org_id: orgId,
        score,
        by_region: {
          'South Asia': Math.max(24, score - 7),
          'Indian Ocean': Math.min(90, score + (alertSpike ? 8 : 2)),
          'East Africa': Math.min(86, score + (focus === 'Kenya' ? 11 : 0)),
          Gulf: Math.max(28, score - 10),
          __focus: focus,
          __entity_id: entity ? String(entity._id) : null,
        },
        by_route: {
          'India → East Africa via Suez': Math.min(94, score + (alertSpike ? 13 : 4)),
          'India → Gulf via Persian Gulf': Math.max(22, score - 8),
          'India → Southern Africa direct': Math.max(20, score - 12),
          __focus: focus,
        },
        by_severity: {
          critical: alertSpike && focusIdx <= 2 ? 1 : 0,
          high: alertSpike ? 2 : 1,
          medium: 3 + (day % 3),
          low: 2 + (focusIdx % 2),
          info: 1,
        },
        alert_count_7d: alertSpike ? 6 + focusIdx : 2 + (day % 4),
        computed_at: new Date(now.getTime() - day * DAY_MS + focusIdx * 60 * 60 * 1000),
      });
    }
  }
  await RiskScore.insertMany(scores);
  console.log('[seed] Risk scores: done');
}

async function seedSupplierLinks(orgId: Types.ObjectId, entities: EntityDoc[]) {
  await SupplierLink.deleteMany({ org_id: orgId });
  const byName = new Map(entities.map(e => [e.name, e]));
  const edgeDefs = [
    ['Aurobindo Pharma HQ', 'Dr Reddys Hyderabad', 1, 'manual'],
    ['Aurobindo Pharma HQ', 'Lupin Pune Plant', 2, 'extracted'],
    ['Cipla Goa Plant', 'Alkem Daman Plant', 1, 'manual'],
    ['Cipla Goa Plant', 'Macleods Mumbai Plant', 2, 'imported_csv'],
    ['Dr Reddys Hyderabad', 'Strides Bangalore', 1, 'manual'],
    ['Dr Reddys Hyderabad', 'Intas Chennai Facility', 2, 'extracted'],
    ['Mylan Nashik Facility', 'Sun Pharma Vadodara', 1, 'imported_csv'],
    ['Torrent Ahmedabad', 'Zydus Ahmedabad R&D', 1, 'manual'],
    ['Lupin Pune Plant', 'Mylan Nashik Facility', 2, 'extracted'],
    ['Sun Pharma Vadodara', 'Torrent Ahmedabad', 2, 'manual'],
    ['Alkem Daman Plant', 'Cipla Goa Plant', 3, 'extracted'],
    ['Zydus Ahmedabad R&D', 'Aurobindo Pharma HQ', 2, 'imported_csv'],
    ['Intas Chennai Facility', 'Chennai Port', 1, 'manual'],
    ['Macleods Mumbai Plant', 'JNPT (Jawaharlal Nehru Port)', 1, 'manual'],
    ['Strides Bangalore', 'Cochin Port', 1, 'manual'],
    ['JNPT (Jawaharlal Nehru Port)', 'India → East Africa via Suez', 2, 'imported_csv'],
    ['Mundra Port', 'India → Gulf via Persian Gulf', 2, 'imported_csv'],
    ['Cochin Port', 'India → Southern Africa direct', 2, 'imported_csv'],
  ] as const;

  await SupplierLink.insertMany(edgeDefs.flatMap(([parentName, childName, tier, source]) => {
    const parent = byName.get(parentName);
    const child = byName.get(childName);
    if (!parent || !child) return [];
    return [{
      org_id: orgId,
      parent_entity_id: objectId(parent._id),
      child_entity_id: objectId(child._id),
      tier_offset: tier,
      source,
      confidence_pct: source === 'manual' ? 100 : source === 'imported_csv' ? 85 : 78,
    }];
  }));
  console.log('[seed] Supplier links: done');
}

async function seedScenarios(orgId: Types.ObjectId, userId: Types.ObjectId, entities: EntityDoc[], now: Date) {
  const byName = new Map(entities.map(e => [e.name, e]));
  const defs = [
    {
      name: 'Suez closure: 21-day Red Sea bypass',
      description: 'Assumes Bab-el-Mandeb and southern Red Sea remain closed to container traffic, forcing Cape of Good Hope routing for East Africa consignments.',
      hypothesis_events: [{ type: 'physical_risk', geo: 'YE', severity: 'critical' }],
      affectedNames: ['India → East Africa via Suez', 'JNPT (Jawaharlal Nehru Port)', 'Kenya', 'Tanzania'],
      computed_var_total_usd: 6_950_000,
    },
    {
      name: 'INR 15% drop against USD',
      description: 'Assumes sudden INR depreciation raises USD-denominated freight, insurance, and API import costs while improving export receivable conversion.',
      hypothesis_events: [{ type: 'compliance', geo: 'IN', severity: 'high' }],
      affectedNames: ['Aurobindo Pharma HQ', 'Cipla Goa Plant', 'Dr Reddys Hyderabad', 'Dubai Distribution Hub'],
      computed_var_total_usd: 2_400_000,
    },
    {
      name: 'Maharashtra power outage: 72-hour industrial load shedding',
      description: 'Assumes grid instability interrupts Nashik, Mumbai, and Pune manufacturing plus JNPT cold-chain staging.',
      hypothesis_events: [{ type: 'physical_risk', geo: 'IN-MH', severity: 'high' }],
      affectedNames: ['Mylan Nashik Facility', 'Macleods Mumbai Plant', 'Lupin Pune Plant', 'JNPT (Jawaharlal Nehru Port)'],
      computed_var_total_usd: 3_100_000,
    },
  ] as const;

  for (const def of defs) {
    await Scenario.updateOne(
      { org_id: orgId, name: def.name },
      {
        $set: {
          description: def.description,
          hypothesis_events: def.hypothesis_events,
          affected_entity_ids: def.affectedNames.flatMap(name => {
            const entity = byName.get(name);
            return entity ? [objectId(entity._id)] : [];
          }),
          computed_var_total_usd: def.computed_var_total_usd,
          computed_at: now,
          created_by: userId,
        },
      },
      { upsert: true },
    );
  }
  console.log('[seed] Scenarios: done');
}

async function seedIntelClaimsAndForecasts(orgId: Types.ObjectId, alerts: AlertDoc[], entities: EntityDoc[], now: Date) {
  await IntelClaim.deleteMany({ evidence_url: /^seed:\/\/sundaram-pharma-v3\// });
  // Forecast upsert keys on expires_at, which shifts between runs because horizon
  // is computed from `now`. Clear seed forecasts first to keep the seeder idempotent.
  await Forecast.deleteMany({ org_id: orgId });
  const sources = await SourceReliability.find({
    source_id: { $in: ['reuters', 'al-jazeera', 'lloyds-list', 'gdelt', 'local-news', 'social-media'] },
  }) as unknown as SourceDoc[];
  const source = (id: string) => {
    const found = sources.find(s => s.source_id === id);
    if (!found) throw new Error(`Missing source reliability seed: ${id}`);
    return found;
  };
  const redSeaAlert = titleIncludes(alerts, 'Galaxy Leader') ?? alerts[0];
  const imoAlert = titleIncludes(alerts, 'IMO') ?? redSeaAlert;
  const mombasaAlert = titleIncludes(alerts, 'Mombasa') ?? alerts[1] ?? redSeaAlert;
  const cycloneAlert = titleIncludes(alerts, 'Cyclone') ?? alerts[2] ?? redSeaAlert;

  const baseClaims = await IntelClaim.insertMany([
    { source_id: source('reuters')._id, claim_text: 'Reuters reports multiple container carriers suspended Red Sea sailings after a vessel strike west of Hodeidah.', evidence_url: 'seed://sundaram-pharma-v3/red-sea/reuters-carrier-suspension', asserted_at: new Date(now.getTime() - 50 * 60_000), parent_claim_ids: [], claim_type: 'fact', alert_id: objectId(redSeaAlert._id) },
    { source_id: source('lloyds-list')._id, claim_text: "Lloyd's List reports war-risk underwriters widened Red Sea exclusions for southbound transits below 15 degrees north.", evidence_url: 'seed://sundaram-pharma-v3/red-sea/lloyds-war-risk', asserted_at: new Date(now.getTime() - 45 * 60_000), parent_claim_ids: [], claim_type: 'fact', alert_id: objectId(imoAlert._id) },
    { source_id: source('al-jazeera')._id, claim_text: 'Al Jazeera regional desk reports naval advisories warning commercial vessels to avoid Bab-el-Mandeb overnight.', evidence_url: 'seed://sundaram-pharma-v3/red-sea/aljazeera-naval-advisory', asserted_at: new Date(now.getTime() - 43 * 60_000), parent_claim_ids: [], claim_type: 'fact', alert_id: objectId(redSeaAlert._id) },
    { source_id: source('gdelt')._id, claim_text: 'GDELT event volume for Red Sea shipping disruption terms rose 2.4 standard deviations above the 90-day baseline.', evidence_url: 'seed://sundaram-pharma-v3/red-sea/gdelt-volume', asserted_at: new Date(now.getTime() - 35 * 60_000), parent_claim_ids: [], claim_type: 'fact', alert_id: objectId(redSeaAlert._id) },
    { source_id: source('local-news')._id, claim_text: 'Mombasa logistics bulletins report berth queues exceeding nine vessels after docker work stoppages.', evidence_url: 'seed://sundaram-pharma-v3/mombasa/local-queue', asserted_at: new Date(now.getTime() - 90 * 60_000), parent_claim_ids: [], claim_type: 'fact', alert_id: objectId(mombasaAlert._id) },
    { source_id: source('reuters')._id, claim_text: 'Reuters notes Kenya Ports Authority has not published a firm restart time for Mombasa container operations.', evidence_url: 'seed://sundaram-pharma-v3/mombasa/reuters-restart', asserted_at: new Date(now.getTime() - 84 * 60_000), parent_claim_ids: [], claim_type: 'fact', alert_id: objectId(mombasaAlert._id) },
    { source_id: source('local-news')._id, claim_text: 'Maharashtra industrial feeder operators warned pharma estates near Nashik and Pune of rolling outages if peak load rises.', evidence_url: 'seed://sundaram-pharma-v3/maharashtra/local-grid', asserted_at: new Date(now.getTime() - 130 * 60_000), parent_claim_ids: [], claim_type: 'fact', alert_id: null },
    { source_id: source('social-media')._id, claim_text: 'Social posts from Chennai port truckers show container gate queues forming ahead of the cyclone notice.', evidence_url: 'seed://sundaram-pharma-v3/chennai/social-gate-queue', asserted_at: new Date(now.getTime() - 150 * 60_000), parent_claim_ids: [], claim_type: 'fact', alert_id: objectId(cycloneAlert._id) },
    { source_id: source('gdelt')._id, claim_text: 'Currency shock mentions tied to INR hedging rose across Indian export finance coverage in the last seven days.', evidence_url: 'seed://sundaram-pharma-v3/fx/gdelt-inr-mentions', asserted_at: new Date(now.getTime() - 210 * 60_000), parent_claim_ids: [], claim_type: 'fact', alert_id: null },
    { source_id: source('reuters')._id, claim_text: 'Reuters reports Suez surcharge guidance from carriers is being revised while Cape diversions remain under review.', evidence_url: 'seed://sundaram-pharma-v3/suez/reuters-surcharge', asserted_at: new Date(now.getTime() - 230 * 60_000), parent_claim_ids: [], claim_type: 'fact', alert_id: objectId(redSeaAlert._id) },
    { source_id: source('lloyds-list')._id, claim_text: "Lloyd's List port-call data shows vessel bunching near Jeddah and Djibouti anchorages.", evidence_url: 'seed://sundaram-pharma-v3/red-sea/lloyds-bunching', asserted_at: new Date(now.getTime() - 250 * 60_000), parent_claim_ids: [], claim_type: 'fact', alert_id: objectId(redSeaAlert._id) },
    { source_id: source('al-jazeera')._id, claim_text: 'Al Jazeera reports regional officials expect Red Sea negotiations to take days rather than hours.', evidence_url: 'seed://sundaram-pharma-v3/red-sea/aljazeera-negotiations', asserted_at: new Date(now.getTime() - 270 * 60_000), parent_claim_ids: [], claim_type: 'fact', alert_id: objectId(redSeaAlert._id) },
  ]);

  const inferred = await IntelClaim.insertMany([
    { source_id: source('gdelt')._id, claim_text: 'Inference: Red Sea disruption risk is corroborated by carrier suspensions, war-risk exclusions, and abnormal event-volume velocity.', evidence_url: 'seed://sundaram-pharma-v3/red-sea/inference-corroborated', asserted_at: new Date(now.getTime() - 20 * 60_000), parent_claim_ids: [objectId(baseClaims[0]._id), objectId(baseClaims[1]._id), objectId(baseClaims[3]._id)], claim_type: 'inference', alert_id: objectId(redSeaAlert._id) },
    { source_id: source('reuters')._id, claim_text: 'Forecast claim: India to East Africa container delays are likely to exceed 14 days if Red Sea advisories persist for one week.', evidence_url: 'seed://sundaram-pharma-v3/red-sea/forecast-delay', asserted_at: new Date(now.getTime() - 15 * 60_000), parent_claim_ids: [objectId(baseClaims[0]._id), objectId(baseClaims[1]._id), objectId(baseClaims[10]._id)], claim_type: 'forecast', alert_id: objectId(redSeaAlert._id) },
    { source_id: source('local-news')._id, claim_text: 'Inference: Maharashtra outage exposure is concentrated around Nashik, Mumbai, Pune, and JNPT cold-chain staging windows.', evidence_url: 'seed://sundaram-pharma-v3/maharashtra/inference-outage-cluster', asserted_at: new Date(now.getTime() - 25 * 60_000), parent_claim_ids: [objectId(baseClaims[6]._id), objectId(baseClaims[8]._id)], claim_type: 'inference', alert_id: null },
    { source_id: source('gdelt')._id, claim_text: 'Inference: Mombasa congestion is likely to push Nairobi distribution receipts beyond the current reorder point.', evidence_url: 'seed://sundaram-pharma-v3/mombasa/inference-nairobi-reorder', asserted_at: new Date(now.getTime() - 30 * 60_000), parent_claim_ids: [objectId(baseClaims[4]._id), objectId(baseClaims[5]._id)], claim_type: 'inference', alert_id: objectId(mombasaAlert._id) },
    { source_id: source('social-media')._id, claim_text: 'Low-confidence signal: gate queue imagery supports the Chennai cyclone staging risk but needs port authority confirmation.', evidence_url: 'seed://sundaram-pharma-v3/chennai/inference-social-low-confidence', asserted_at: new Date(now.getTime() - 32 * 60_000), parent_claim_ids: [objectId(baseClaims[7]._id)], claim_type: 'inference', alert_id: objectId(cycloneAlert._id) },
  ]);

  const indicators = await LeadingIndicator.find({ org_id: 'system' }).sort({ name: 1 }) as unknown as IndicatorDoc[];
  const entityByName = new Map(entities.map(e => [e.name, e]));
  const forecastDefs = [
    ['commodity-price-spike', 'commodity-price', 'India → East Africa via Suez', 62, 30, null, null, [baseClaims[9], inferred[0]], 'Freight and bunker surcharges are rising as carriers quote Cape routing contingencies.', 'Reserve Q3 freight budget and request surcharge caps in forwarder quotes.'],
    ['currency-volatility', 'currency-shock', null, 57, 21, 'occurred', 0.1849, [baseClaims[8]], 'INR volatility has moved above baseline and can reprice USD freight and insurance outlays.', 'Review open USD payables and hedge near-term freight invoices.'],
    ['port-call-rate-anomaly', 'port-congestion', 'JNPT (Jawaharlal Nehru Port)', 48, 14, 'did_not_occur', 0.2304, [baseClaims[10]], 'Port-call anomaly is elevated but still concentrated away from JNPT.', 'Monitor JNPT gate dwell and keep Kochi as backup loading option.'],
    ['regulatory-mention-frequency', 'sanctions-likelihood', 'Dubai Distribution Hub', 36, 45, null, null, [baseClaims[8]], 'Regulatory mentions are elevated but not yet tied to a specific Sundaram counterparty.', 'Run enhanced screening on UAE banking intermediaries.'],
    ['sanctions-list-velocity', 'sanctions-likelihood', 'UAE', 42, 60, 'did_not_occur', 0.1764, [baseClaims[8]], 'List velocity is above baseline following regional financial restrictions.', 'Pre-clear letters of credit with compliance counsel.'],
    ['shipping-deviation-frequency', 'shipping-delay', 'India → East Africa via Suez', 78, 14, null, null, [baseClaims[0], inferred[1]], 'Stopped-vessel and diversion signals are aligned with carrier suspensions.', 'Trigger East Africa customer delay notices and evaluate air freight for critical SKUs.'],
    ['supplier-news-velocity', 'geopolitical-event', 'Mylan Nashik Facility', 51, 10, null, null, [baseClaims[6], inferred[2]], 'Supplier-linked outage mentions are increasing in Maharashtra industrial clusters.', 'Confirm backup generator fuel and shift inventory staging away from Nashik.'],
    ['vessel-position-anomaly', 'shipping-delay', 'Kenya', 68, 21, 'occurred', 0.1024, [baseClaims[4], inferred[3]], 'Mombasa queue reports and abnormal vessel positions indicate Nairobi receipt delays.', 'Request berthing queue position and update distributor safety stock.'],
  ] as const;

  for (const [indicatorName, indicatorType, entityName, probability, horizon, outcome, brier, claims, narrative, action] of forecastDefs) {
    const indicator = indicators.find(i => i.name === indicatorName);
    if (!indicator) continue;
    const expiresAt = daysFromNow(horizon, now);
    const entity = entityName ? entityByName.get(entityName) : null;
    await Forecast.updateOne(
      { org_id: orgId, indicator_id: objectId(indicator._id), expires_at: expiresAt },
      {
        $set: {
          indicator_type: indicatorType,
          target_entity_id: entity ? objectId(entity._id) : null,
          probability_pct: probability,
          time_horizon_days: horizon,
          supporting_claims: claims.map(c => objectId(c._id)),
          narrative,
          recommended_action: action,
          computed_at: now,
          methodology: 'Seeded synthesis of leading indicator z-score, source reliability, provenance depth, and current alert severity.',
          actual_outcome: outcome,
          brier_score: brier,
        },
      },
      { upsert: true },
    );
  }
  console.log('[seed] Intel claims and forecasts: done');
}

async function seedMitigationsAndDecisions(orgId: Types.ObjectId, users: UserDoc[], alerts: AlertDoc[], now: Date) {
  await MitigationSuggestion.deleteMany({ org_id: orgId });
  await Decision.deleteMany({ org_id: orgId, decision_text: /^\[seed\]/ });
  const user = users[0];
  if (!user) throw new Error('Sundaram v3 seed requires at least one user');
  const redSeaAlert = titleIncludes(alerts, 'Galaxy Leader') ?? alerts[0];
  const mombasaAlert = titleIncludes(alerts, 'Mombasa') ?? alerts[1] ?? redSeaAlert;
  const cycloneAlert = titleIncludes(alerts, 'Cyclone') ?? alerts[2] ?? redSeaAlert;
  const apapaAlert = titleIncludes(alerts, 'Apapa') ?? alerts[3] ?? redSeaAlert;

  await MitigationSuggestion.insertMany([
    { org_id: orgId, alert_id: objectId(redSeaAlert._id), suggestion_type: 'alt_route', narrative: 'Divert East Africa containers around Cape of Good Hope for booked sailings with customer-visible inventory risk.', confidence_pct: 86, estimated_var_reduction_usd: 1_150_000, sources: ['Reuters', "Lloyd's List"], status: 'accepted' },
    { org_id: orgId, alert_id: objectId(redSeaAlert._id), suggestion_type: 'inventory_buffer', narrative: 'Release Nairobi warehouse reserve stock to cover 21 days of antimalarial demand before shipment ETA moves.', confidence_pct: 73, estimated_var_reduction_usd: 620_000, sources: ['ERP reorder report', 'Mombasa queue bulletin'], status: 'proposed' },
    { org_id: orgId, alert_id: objectId(mombasaAlert._id), suggestion_type: 'alt_route', narrative: 'Evaluate Dar es Salaam discharge for Kenya-bound non-cold-chain cartons if Mombasa berth delay exceeds 10 days.', confidence_pct: 64, estimated_var_reduction_usd: 410_000, sources: ['KPA notice', 'Forwarder quote'], status: 'proposed' },
    { org_id: orgId, alert_id: objectId(cycloneAlert._id), suggestion_type: 'alt_supplier', narrative: 'Pull urgent injectable lots from Strides Bangalore instead of Intas Chennai until cyclone gate restrictions clear.', confidence_pct: 58, estimated_var_reduction_usd: 280_000, sources: ['IMD notice', 'Supplier capacity call'], status: 'proposed' },
    { org_id: orgId, alert_id: objectId(apapaAlert._id), suggestion_type: 'contract_clause', narrative: 'Invoke distributor force majeure notice window for Lagos deliveries before demurrage liability accumulates.', confidence_pct: 76, estimated_var_reduction_usd: 340_000, sources: ['Distribution agreement', 'NPA circular'], status: 'accepted' },
    { org_id: orgId, alert_id: objectId(redSeaAlert._id), suggestion_type: 'contract_clause', narrative: 'Reject premium air freight for low-margin SKUs until cargo insurer confirms war-risk exclusion scope.', confidence_pct: 44, estimated_var_reduction_usd: null, sources: ['Marine policy schedule'], status: 'rejected' },
  ]);

  const decisionDefs = [
    [redSeaAlert, user, 'acknowledged', 'Red Sea critical alert acknowledged by control tower.', 'Carrier suspensions and insurer exclusions are corroborated by high-reliability sources.'],
    [redSeaAlert, users[1] ?? user, 'assigned', 'Assigned route diversion analysis to logistics lead.', 'East Africa orders have highest time-sensitive VaR.'],
    [redSeaAlert, user, 'mitigation_chosen', 'Approved Cape diversion for two Nairobi-bound containers.', 'Expected VaR reduction exceeds incremental freight and delay penalties.'],
    [mombasaAlert, users[1] ?? user, 'acknowledged', 'Mombasa berth disruption acknowledged.', 'Nairobi warehouse reorder point is inside the likely delay window.'],
    [mombasaAlert, users[2] ?? user, 'assigned', 'Assigned distributor communications for Kenya and Tanzania.', 'Customers need revised ETAs before stockout notices trigger.'],
    [cycloneAlert, users[1] ?? user, 'acknowledged', 'Chennai cyclone staging risk acknowledged.', 'Port closure notice overlaps Intas shipment loading window.'],
    [cycloneAlert, users[1] ?? user, 'closed', 'Closed Chennai action after Kochi backup slot was confirmed.', 'Forwarder confirmed alternate loading and no cold-chain break.'],
    [apapaAlert, users[2] ?? user, 'escalated', 'Escalated Nigeria consignment delay to commercial team.', 'Apapa strike may affect distributor service-level commitments.'],
    [apapaAlert, user, 'mitigation_chosen', 'Approved force majeure notice draft for Lagos distributor.', 'Contract notice period expires before expected strike resolution.'],
    [redSeaAlert, users[2] ?? user, 'assigned', 'Assigned insurance coverage review for marine and cargo policies.', 'War-risk exclusion may move uninsured gap above tolerance.'],
  ] as const;

  await Decision.insertMany(decisionDefs.map(([alert, decisionUser, type, text, justification], idx) => ({
    org_id: orgId,
    alert_id: objectId(alert._id),
    user_id: objectId(decisionUser._id),
    decision_type: type,
    decision_text: `[seed] ${text}`,
    justification,
    made_at: new Date(now.getTime() - (idx + 1) * 42 * 60_000),
  })));
  console.log('[seed] Mitigations and decisions: done');
}

async function seedWarRooms(orgId: Types.ObjectId, users: UserDoc[], alerts: AlertDoc[], now: Date) {
  const rooms = [
    { name: 'Red Sea diversion cell', alert: titleIncludes(alerts, 'Galaxy Leader') ?? alerts[0], messages: ['Carrier desk confirms MSC and Hapag-Lloyd are holding acceptance for Red Sea legs.', 'Finance approved provisional Cape surcharge reserve for critical SKUs.', 'Insurance broker is checking war-risk exclusion wording against active policies.', 'Nairobi distributor wants the first revised ETA by 18:00 IST.', 'Decision: keep antimalarial shipment moving via Cape unless air freight quote drops below threshold.', 'Next update after forwarder berth allocation call.'] },
    { name: 'Mombasa congestion desk', alert: titleIncludes(alerts, 'Mombasa') ?? alerts[1] ?? alerts[0], messages: ['KPA queue report still shows berths 19-24 unavailable.', 'Nairobi warehouse can cover 16 days at current consumption.', 'Dar es Salaam discharge adds customs complexity but keeps product moving.', 'Commercial team has notified Kenya distributor of risk window.', 'Holding decision until next vessel lineup update.'] },
    { name: 'Chennai cyclone response', alert: titleIncludes(alerts, 'Cyclone') ?? alerts[2] ?? alerts[0], messages: ['Intas shipment is still outside the gate queue.', 'Kochi backup slot is available for dry cargo only.', 'Cold-chain cartons need generator-backed staging if Chennai closure extends.', 'IMD track update expected tonight.', 'Forwarder asked for go/no-go by 06:00 IST tomorrow.'] },
  ];

  for (const roomDef of rooms) {
    const room = await WarRoom.findOneAndUpdate(
      { org_id: orgId, name: roomDef.name },
      {
        $set: {
          alert_id: objectId(roomDef.alert._id),
          status: 'open',
          created_by: objectId(users[0]._id),
          participants: users.map(u => objectId(u._id)),
        },
      },
      { upsert: true, new: true },
    );
    await WarRoomMessage.deleteMany({ war_room_id: room._id });
    await WarRoomMessage.insertMany(roomDef.messages.map((body, idx) => ({
      war_room_id: objectId(room._id),
      user_id: objectId(users[idx % users.length]._id),
      body,
      attachments: idx === 2 ? ['seed://sundaram-pharma-v3/warroom/supporting-brief.pdf'] : [],
      created_at: new Date(now.getTime() - (roomDef.messages.length - idx) * 17 * 60_000),
    })));
  }
  console.log('[seed] War rooms: done');
}

async function seedCommercialCollections(orgId: Types.ObjectId, entities: EntityDoc[], now: Date) {
  const byName = new Map(entities.map(e => [e.name, e]));
  const entityId = (name: string) => {
    const entity = byName.get(name);
    if (!entity) throw new Error(`Missing Sundaram entity: ${name}`);
    return objectId(entity._id);
  };

  const facilities = [
    { name: 'Nairobi Distribution Warehouse', kind: 'facility', location_geo: { lat: -1.2833, lng: 36.8167 }, value_usd: 3_200_000, criticality: 'critical' },
    { name: 'Dubai Distribution Hub', kind: 'facility', location_geo: { lat: 25.2048, lng: 55.2708 }, value_usd: 4_100_000, criticality: 'high' },
    { name: 'JNPT Cold Chain Staging Yard', kind: 'facility', location_geo: { lat: 18.9480, lng: 72.9481 }, value_usd: 1_400_000, criticality: 'high' },
    { name: 'Chennai Export QA Lab', kind: 'facility', location_geo: { lat: 13.0827, lng: 80.2707 }, value_usd: 900_000, criticality: 'medium' },
    { name: 'Mumbai Regulatory Archive', kind: 'facility', location_geo: { lat: 19.0760, lng: 72.8777 }, value_usd: 550_000, criticality: 'medium' },
  ] as const;

  for (const asset of facilities) {
    await Asset.updateOne({ org_id: orgId, name: asset.name }, { $set: { ...asset, active: true } }, { upsert: true });
  }

  const shipments = [
    ['SP-SHP-260501', 'JNPT (Jawaharlal Nehru Port)', 'Kenya', 'in_transit', 840_000, '9781234', { lat: 12.3, lng: 61.2, heading: 245, speed_kn: 15.2 }],
    ['SP-SHP-260502', 'Mundra Port', 'UAE', 'in_transit', 420_000, '9781235', { lat: 23.1, lng: 61.8, heading: 270, speed_kn: 13.1 }],
    ['SP-SHP-260503', 'Chennai Port', 'Tanzania', 'draft', 215_000, null, null],
    ['SP-SHP-260504', 'Cochin Port', 'South Africa', 'in_transit', 670_000, '9781236', { lat: -4.2, lng: 64.4, heading: 220, speed_kn: 14.7 }],
    ['SP-SHP-260505', 'JNPT (Jawaharlal Nehru Port)', 'Nigeria', 'in_transit', 1_150_000, '9781237', { lat: 14.8, lng: 42.7, heading: 315, speed_kn: 2.3 }],
    ['SP-SHP-260506', 'Mundra Port', 'Saudi Arabia', 'in_transit', 350_000, '9781238', { lat: 21.4, lng: 59.2, heading: 288, speed_kn: 12.4 }],
    ['SP-SHP-260507', 'Chennai Port', 'Ghana', 'draft', 190_000, null, null],
    ['SP-SHP-260508', 'Cochin Port', 'Kenya', 'in_transit', 520_000, '9781239', { lat: 3.1, lng: 67.8, heading: 250, speed_kn: 16.0 }],
    ['SP-SHP-260509', 'JNPT (Jawaharlal Nehru Port)', 'Egypt', 'in_transit', 610_000, '9781240', { lat: 18.1, lng: 53.6, heading: 300, speed_kn: 11.2 }],
    ['SP-SHP-260510', 'Chennai Port', 'UAE', 'draft', 260_000, null, null],
  ] as const;

  for (const [ref, origin, destination, status, value, imo, pos] of shipments) {
    await Shipment.updateOne(
      { org_id: orgId, ref },
      {
        $set: {
          origin_entity_id: entityId(origin),
          destination_entity_id: entityId(destination),
          route_polyline: [{ lat: 18.9480, lng: 72.9481 }, { lat: 12.0, lng: 61.0 }, { lat: -1.2921, lng: 36.8219 }],
          status,
          eta_at: daysFromNow(7 + (value % 9), now),
          value_usd: value,
          active: true,
          vessel_imo: imo,
          ais_tracked: Boolean(pos),
          ais_position: pos ? { ...pos, updated_at: now } : null,
        },
      },
      { upsert: true },
    );
  }

  const counterpartyDefs = [
    ...['Aurobindo Pharma HQ', 'Cipla Goa Plant', 'Dr Reddys Hyderabad', 'Mylan Nashik Facility', 'Torrent Ahmedabad', 'Lupin Pune Plant', 'Sun Pharma Vadodara', 'Alkem Daman Plant', 'Zydus Ahmedabad R&D', 'Intas Chennai Facility', 'Macleods Mumbai Plant', 'Strides Bangalore'].map((name, idx) => [name, 'supplier', 34 + idx * 3, 250_000 + idx * 110_000] as const),
    ...['Kenya', 'Nigeria', 'Ghana', 'South Africa', 'UAE', 'Saudi Arabia', 'Egypt', 'Tanzania'].map((name, idx) => [name, 'customer', 28 + idx * 4, 380_000 + idx * 170_000] as const),
    ...['JNPT (Jawaharlal Nehru Port)', 'Mundra Port', 'Chennai Port', 'Cochin Port'].map((name, idx) => [name, 'logistics', 45 + idx * 5, 180_000 + idx * 90_000] as const),
  ];
  for (const [name, role, risk, value] of counterpartyDefs) {
    await Counterparty.updateOne(
      { org_id: orgId, entity_id: entityId(name), role },
      { $set: { risk_score: risk, relationship_value_usd: value, active: true } },
      { upsert: true },
    );
  }

  const counterparties = await Counterparty.find({ org_id: orgId }).sort({ role: 1, risk_score: -1 });
  const contractTypes = ['supply', 'service', 'distribution', 'nda', 'other'] as const;
  for (let idx = 0; idx < 18; idx += 1) {
    const counterparty = counterparties[idx];
    if (!counterparty) continue;
    const ref = `SP-CON-2026-${String(idx + 1).padStart(3, '0')}`;
    const contract = await Contract.findOneAndUpdate(
      { org_id: orgId, ref },
      {
        $set: {
          counterparty_id: objectId(counterparty._id),
          type: contractTypes[idx % contractTypes.length],
          value_usd: 180_000 + idx * 95_000,
          expires_at: daysFromNow(90 + idx * 18, now),
          terms_summary: idx % 3 === 0 ? 'Includes port disruption notice period and demurrage pass-through cap.' : 'Standard pharma export terms with quality and delivery service levels.',
          force_majeure_clauses: idx % 2 === 0 ? ['port closure', 'war risk', 'government restriction'] : ['natural disaster', 'labor action'],
          active: true,
        },
      },
      { upsert: true, new: true },
    );
    await Counterparty.updateOne({ _id: counterparty._id }, { $set: { contract_id: contract._id } });
  }

  const suppliers = entities.filter(e => e.type === 'supplier');
  const poItems = ['Cefixime API', 'Artemether tablets', 'Cold-chain injectables', 'Blister packaging', 'Quality assay kits'];
  for (let idx = 0; idx < 18; idx += 1) {
    const supplier = suppliers[idx % suppliers.length];
    const qty = 100 + idx * 25;
    const unit = 72 + idx * 6;
    await PurchaseOrder.updateOne(
      { org_id: orgId, po_number: `SP-PO-2026-${String(idx + 1).padStart(3, '0')}` },
      {
        $set: {
          supplier_entity_id: objectId(supplier._id),
          items: [{ description: poItems[idx % poItems.length], qty, unit_price_usd: unit }],
          total_usd: qty * unit,
          status: ['approved', 'shipped', 'received', 'draft'][idx % 4],
          due_at: daysFromNow(5 + idx * 2, now),
          active: true,
        },
      },
      { upsert: true },
    );
  }
  console.log('[seed] Assets, shipments, counterparties, contracts, and POs: done');
}

async function seedPreferencesAndControls(orgId: Types.ObjectId, users: UserDoc[], entities: EntityDoc[], now: Date) {
  for (const [idx, user] of users.entries()) {
    if (idx > 2) break;
    await DigestPreference.updateOne(
      { org_id: orgId, user_id: objectId(user._id) },
      {
        $set: {
          frequency: idx === 2 ? 'weekly' : 'daily',
          channels: idx === 1 ? ['email', 'webhook'] : ['email'],
          sections: ['alerts', 'severity_heatmap', 'watchlist_health', 'var_summary'],
          enabled: true,
          channel_configs: [
            { channel_id: 'email', destination_id: user.email, format: idx === 0 ? 'full' : 'summary', enabled: true },
            { channel_id: idx === 2 ? 'teams' : 'slack', destination_id: idx === 2 ? 'teams-risk-room' : 'slack-supply-risk', format: 'oneliner', enabled: idx !== 1 },
          ],
          delivery_window: { start_hour: 8, end_hour: 19, timezone: 'Asia/Kolkata' },
          priority_threshold: idx === 0 ? 'medium' : 'high',
        },
      },
      { upsert: true },
    );
  }

  const channelDefs = [
    [users[0], 'email', 'priya@sundarampharma.com', true],
    [users[0], 'slack', '#sundaram-risk', true],
    [users[1], 'email', 'arjun@sundarampharma.com', true],
    [users[1], 'teams', 'Supply Chain Risk', true],
    [users[2], 'email', 'nadia@sundarampharma.com', true],
    [users[2], 'webhook', 'https://hooks.sundarampharma.example/risk', false],
  ] as const;
  for (const [user, channelType, destination, verified] of channelDefs) {
    if (!user) continue;
    await NotificationChannel.updateOne(
      { org_id: orgId, user_id: objectId(user._id), channel_type: channelType, destination },
      { $set: { verified } },
      { upsert: true },
    );
  }

  const customSources = [
    { name: 'Red Sea Forwarder Telegram', source_type: 'telegram', config: { channel_id: '-1001888123456', bot_token_enc: 'seed:encrypted:telegram', schedule_cron: '*/15 * * * *' }, status: 'active', last_polled_at: new Date(now.getTime() - 9 * 60_000), error_count: 0 },
    { name: 'Africa Distributor Discord', source_type: 'discord', config: { server_id: 'seed-africa-dist', channel_ids: ['kenya-ops', 'nigeria-ops'], bot_token_enc: 'seed:encrypted:discord' }, status: 'paused', last_polled_at: daysFromNow(-2, now), error_count: 1 },
    { name: 'Indian Port Notices RSS', source_type: 'rss-private', config: { url: 'https://ports.example/sundaram/notices.xml', auth_type: 'bearer', auth_token_enc: 'seed:encrypted:rss', schedule_cron: '0 * * * *' }, status: 'active', last_polled_at: new Date(now.getTime() - 45 * 60_000), error_count: 0 },
  ] as const;
  for (const src of customSources) {
    await CustomSource.updateOne({ org_id: orgId, name: src.name }, { $set: src }, { upsert: true });
  }

  await SeverityRule.deleteMany({ org_id: orgId });
  const topEntities = ['India → East Africa via Suez', 'JNPT (Jawaharlal Nehru Port)', 'Kenya', 'Nigeria', 'Chennai Port', 'Dubai Distribution Hub'];
  await SeverityRule.insertMany(topEntities.flatMap((name, idx) => {
    const entity = entities.find(e => e.name === name);
    if (!entity) return [];
    return [{
      org_id: orgId,
      entity_id: objectId(entity._id),
      condition_type: idx % 3 === 0 ? 'always' : idx % 3 === 1 ? 'event_kind' : 'event_kind+geo',
      event_kind: idx % 3 === 0 ? null : idx % 2 === 0 ? 'port_closure' : 'maritime_attack',
      geo_country_code: idx % 3 === 2 ? entity.country_code ?? 'IN' : null,
      threshold: idx < 2 ? 'critical' : idx < 4 ? 'high' : 'medium',
      notification_channels: idx < 3 ? ['email', 'whatsapp'] : ['email', 'webhook'],
      active: true,
    }];
  }));
  console.log('[seed] Preferences, channels, sources, and severity rules: done');
}

async function seedDataFeeds(now: Date) {
  const feeds = [
    { feed_id: 'gdelt-events', name: 'GDELT 2.1 Events', provider: 'GDELT Project', cost_model: 'free', active: true, last_sync_status: 'ok', event_count_total: 128_400, event_count_24h: 2_140 },
    { feed_id: 'acled-crisis', name: 'ACLED Crisis Events', provider: 'ACLED', cost_model: 'freemium', active: true, last_sync_status: 'ok', event_count_total: 42_800, event_count_24h: 410 },
    { feed_id: 'openalex-policy', name: 'OpenAlex Policy Mentions', provider: 'OpenAlex', cost_model: 'free', active: true, last_sync_status: 'degraded', event_count_total: 8_750, event_count_24h: 35 },
    { feed_id: 'world-bank-fx', name: 'World Bank FX and Macro', provider: 'World Bank Open Data', cost_model: 'free', active: true, last_sync_status: 'ok', event_count_total: 12_300, event_count_24h: 18 },
    { feed_id: 'noaa-storms', name: 'NOAA Global Storm Advisories', provider: 'NOAA', cost_model: 'free', active: true, last_sync_status: 'ok', event_count_total: 5_900, event_count_24h: 62 },
    { feed_id: 'un-comtrade', name: 'UN Comtrade Pharma Flows', provider: 'United Nations', cost_model: 'free', active: true, last_sync_status: 'ok', event_count_total: 19_600, event_count_24h: 74 },
  ] as const;

  for (const feed of feeds) {
    await DataFeed.updateOne(
      { feed_id: feed.feed_id },
      { $set: { ...feed, last_sync_at: new Date(now.getTime() - feed.event_count_24h * 1000) } },
      { upsert: true },
    );
  }
  console.log('[seed] Data feeds: done');
}

export async function seedSundaramPharmaV3() {
  console.log('[seed] Seeding Sundaram Pharma v3 collections...');
  const org = await Organization.findOne({ slug: 'sundaram-pharma' }) ?? await seedSundaramPharma();
  const orgId = objectId(org._id);
  const now = new Date();

  const users = await ensureSeedUsers(orgId) as unknown as UserDoc[];
  const entities = await WatchlistEntity.find({ org_id: orgId, active: true }) as unknown as EntityDoc[];
  const alerts = await Alert.find({ org_id: orgId }).sort({ created_at: 1 }) as unknown as AlertDoc[];
  if (entities.length === 0 || alerts.length === 0) {
    throw new Error('Sundaram v3 seed requires base Sundaram watchlist entities and alerts');
  }

  await seedSourceReliabilityV3();
  await seedLeadingIndicatorsV3(now);
  const policies = await seedInsurancePolicies(orgId, now) as unknown as PolicyDoc[];
  await seedExposures(orgId, entities, alerts, policies, now);
  await seedRiskScores(orgId, entities, now);
  await seedSupplierLinks(orgId, entities);
  await seedScenarios(orgId, objectId(users[0]._id), entities, now);
  await seedIntelClaimsAndForecasts(orgId, alerts, entities, now);
  await seedMitigationsAndDecisions(orgId, users, alerts, now);
  await seedWarRooms(orgId, users, alerts, now);
  await seedCommercialCollections(orgId, entities, now);
  await seedPreferencesAndControls(orgId, users, entities, now);
  await seedDataFeeds(now);

  console.log('[seed] Sundaram Pharma v3 seed complete. org_id:', orgId.toString());
  return org;
}

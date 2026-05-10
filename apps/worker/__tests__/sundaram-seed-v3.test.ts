import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { seedSundaramPharma } from '../../../packages/db/seed/sundaram-pharma';
import { seedSundaramPharmaV3 } from '../../../packages/db/seed/sundaram-pharma-v3';
import { Organization } from '../../../packages/db/models/Organization';
import { Exposure } from '../../../packages/db/models/Exposure';
import { RiskScore } from '../../../packages/db/models/RiskScore';
import { SupplierLink } from '../../../packages/db/models/SupplierLink';
import { Scenario } from '../../../packages/db/models/Scenario';
import { MitigationSuggestion } from '../../../packages/db/models/MitigationSuggestion';
import { Forecast } from '../../../packages/db/models/Forecast';
import { LeadingIndicator } from '../../../packages/db/models/LeadingIndicator';
import { IntelClaim } from '../../../packages/db/models/IntelClaim';
import { SourceReliability } from '../../../packages/db/models/SourceReliability';
import { Decision } from '../../../packages/db/models/Decision';
import { WarRoom } from '../../../packages/db/models/WarRoom';
import { WarRoomMessage } from '../../../packages/db/models/WarRoomMessage';
import { Asset } from '../../../packages/db/models/Asset';
import { Shipment } from '../../../packages/db/models/Shipment';
import { PurchaseOrder } from '../../../packages/db/models/PurchaseOrder';
import { Counterparty } from '../../../packages/db/models/Counterparty';
import { Contract } from '../../../packages/db/models/Contract';
import { DigestPreference } from '../../../packages/db/models/DigestPreference';
import { NotificationChannel } from '../../../packages/db/models/NotificationChannel';
import { CustomSource } from '../../../packages/db/models/CustomSource';
import { InsurancePolicy } from '../../../packages/db/models/InsurancePolicy';
import { SeverityRule } from '../../../packages/db/models/SeverityRule';
import { DataFeed } from '../../../packages/db/models/DataFeed';

let mongod: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

afterEach(async () => {
  await mongoose.connection.db?.dropDatabase();
});

async function v3Counts(orgId: mongoose.Types.ObjectId) {
  return {
    exposures: await Exposure.countDocuments({ org_id: orgId }),
    riskScores: await RiskScore.countDocuments({ org_id: orgId }),
    supplierLinks: await SupplierLink.countDocuments({ org_id: orgId }),
    scenarios: await Scenario.countDocuments({ org_id: orgId }),
    mitigations: await MitigationSuggestion.countDocuments({ org_id: orgId }),
    forecasts: await Forecast.countDocuments({ org_id: orgId }),
    indicators: await LeadingIndicator.countDocuments({ org_id: 'system' }),
    claims: await IntelClaim.countDocuments({}),
    sources: await SourceReliability.countDocuments({
      source_id: { $in: ['reuters', 'al-jazeera', 'lloyds-list', 'gdelt', 'local-news', 'social-media'] },
    }),
    decisions: await Decision.countDocuments({ org_id: orgId }),
    warRooms: await WarRoom.countDocuments({ org_id: orgId }),
    warRoomMessages: await WarRoomMessage.countDocuments({}),
    assets: await Asset.countDocuments({ org_id: orgId }),
    shipments: await Shipment.countDocuments({ org_id: orgId }),
    purchaseOrders: await PurchaseOrder.countDocuments({ org_id: orgId }),
    counterparties: await Counterparty.countDocuments({ org_id: orgId }),
    contracts: await Contract.countDocuments({ org_id: orgId }),
    digestPreferences: await DigestPreference.countDocuments({ org_id: orgId }),
    notificationChannels: await NotificationChannel.countDocuments({ org_id: orgId }),
    customSources: await CustomSource.countDocuments({ org_id: orgId }),
    policies: await InsurancePolicy.countDocuments({ org_id: orgId }),
    severityRules: await SeverityRule.countDocuments({ org_id: orgId }),
    dataFeeds: await DataFeed.countDocuments({}),
  };
}

describe('Sundaram Pharma v3 seed', () => {
  test('populates all new v3 collections idempotently', async () => {
    const org = await seedSundaramPharma();
    await seedSundaramPharmaV3();
    const firstCounts = await v3Counts(org._id as mongoose.Types.ObjectId);

    expect(firstCounts.exposures).toBeGreaterThanOrEqual(8);
    expect(firstCounts.exposures).toBeLessThanOrEqual(12);
    expect(firstCounts.riskScores).toBe(150);
    expect(firstCounts.supplierLinks).toBeGreaterThanOrEqual(15);
    expect(firstCounts.supplierLinks).toBeLessThanOrEqual(25);
    expect(firstCounts.scenarios).toBe(3);
    expect(firstCounts.mitigations).toBeGreaterThanOrEqual(5);
    expect(firstCounts.mitigations).toBeLessThanOrEqual(8);
    expect(firstCounts.forecasts).toBeGreaterThanOrEqual(6);
    expect(firstCounts.forecasts).toBeLessThanOrEqual(10);
    expect(firstCounts.indicators).toBe(8);
    expect(firstCounts.claims).toBeGreaterThanOrEqual(12);
    expect(firstCounts.claims).toBeLessThanOrEqual(20);
    expect(firstCounts.sources).toBe(6);
    expect(firstCounts.decisions).toBeGreaterThanOrEqual(8);
    expect(firstCounts.decisions).toBeLessThanOrEqual(12);
    expect(firstCounts.warRooms).toBeGreaterThanOrEqual(2);
    expect(firstCounts.warRooms).toBeLessThanOrEqual(3);
    expect(firstCounts.warRoomMessages).toBeGreaterThanOrEqual(10);
    expect(firstCounts.warRoomMessages).toBeLessThanOrEqual(30);
    expect(firstCounts.assets).toBeGreaterThanOrEqual(4);
    expect(firstCounts.assets).toBeLessThanOrEqual(6);
    expect(firstCounts.shipments).toBeGreaterThanOrEqual(8);
    expect(firstCounts.shipments).toBeLessThanOrEqual(12);
    expect(firstCounts.purchaseOrders).toBeGreaterThanOrEqual(15);
    expect(firstCounts.purchaseOrders).toBeLessThanOrEqual(20);
    expect(firstCounts.counterparties).toBeGreaterThanOrEqual(20);
    expect(firstCounts.counterparties).toBeLessThanOrEqual(25);
    expect(firstCounts.contracts).toBeGreaterThanOrEqual(15);
    expect(firstCounts.contracts).toBeLessThanOrEqual(20);
    expect(firstCounts.digestPreferences).toBeGreaterThanOrEqual(2);
    expect(firstCounts.digestPreferences).toBeLessThanOrEqual(3);
    expect(firstCounts.notificationChannels).toBeGreaterThanOrEqual(4);
    expect(firstCounts.notificationChannels).toBeLessThanOrEqual(6);
    expect(firstCounts.customSources).toBeGreaterThanOrEqual(2);
    expect(firstCounts.customSources).toBeLessThanOrEqual(3);
    expect(firstCounts.policies).toBeGreaterThanOrEqual(3);
    expect(firstCounts.policies).toBeLessThanOrEqual(5);
    expect(firstCounts.severityRules).toBeGreaterThanOrEqual(5);
    expect(firstCounts.severityRules).toBeLessThanOrEqual(8);
    expect(firstCounts.dataFeeds).toBe(6);

    const exposures = await Exposure.find({ org_id: org._id }).lean();
    expect(exposures.every(e => e.var_value_usd >= 50_000 && e.var_value_usd <= 5_000_000)).toBe(true);
    expect(exposures.every(e => e.insurance_coverage_pct >= 0 && e.insurance_coverage_pct <= 100)).toBe(true);

    await seedSundaramPharmaV3();
    expect(await v3Counts(org._id as mongoose.Types.ObjectId)).toEqual(firstCounts);

    const orgs = await Organization.countDocuments({ slug: 'sundaram-pharma' });
    expect(orgs).toBe(1);
  });
});

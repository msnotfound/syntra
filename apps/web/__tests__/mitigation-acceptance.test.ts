import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Alert } from '../../../packages/db/models/Alert';
import { Contract } from '../../../packages/db/models/Contract';
import { Decision } from '../../../packages/db/models/Decision';
import { DigestPreference } from '../../../packages/db/models/DigestPreference';
import { MitigationSuggestion } from '../../../packages/db/models/MitigationSuggestion';
import { Shipment } from '../../../packages/db/models/Shipment';
import { User } from '../../../packages/db/models/User';
import { WatchlistEntity } from '../../../packages/db/models/WatchlistEntity';
import { acceptMitigationSuggestion } from '../lib/mitigations/acceptance';

let mongod: MongoMemoryServer;

const orgId = new Types.ObjectId();
const userId = new Types.ObjectId();

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Alert.deleteMany({});
  await Contract.deleteMany({});
  await Decision.deleteMany({});
  await DigestPreference.deleteMany({});
  await MitigationSuggestion.deleteMany({});
  await Shipment.deleteMany({});
  await User.deleteMany({});
  await WatchlistEntity.deleteMany({});
});

async function makeUser() {
  return User.create({
    _id: userId,
    clerk_user_id: 'user_mitigation_acceptance',
    email: 'ops@syntra.test',
    name: 'Ops User',
    org_id: orgId,
    role: 'admin',
  });
}

async function makeEntity(name: string, type: 'supplier' | 'route' = 'supplier') {
  return WatchlistEntity.create({
    org_id: orgId,
    type,
    name,
    latitude: null,
    longitude: null,
    country_code: 'IN',
    region: null,
    metadata: {},
    active: true,
    annual_revenue_usd: 1_000_000,
    contribution_pct: 10,
  });
}

async function makeAlert(entityIds: Types.ObjectId[]) {
  return Alert.create({
    org_id: orgId,
    event_id: new Types.ObjectId(),
    watchlist_entity_ids: entityIds,
    severity: 'critical',
    subtype: 'physical_risk',
    match_reasons: ['route'],
    event_snapshot: {
      title: 'Red Sea lane disruption',
      description: 'Shipping route disruption',
      location: { lat: 18.96, lng: 72.82 },
      country: 'India',
      country_code: 'IN',
      event_type: 'port_disruption',
      occurred_at: new Date(),
      sources: [{ url: 'https://example.com/source', name: 'Example' }],
    },
    llm_context: { why_matters: null, recommended_actions: [] },
    status: 'open',
    assignee_user_id: null,
    comments: [],
    dispatched_at: null,
    channels_sent: [],
    acknowledged_at: null,
    acknowledged_by_user_id: null,
    acknowledgement_note: null,
  });
}

describe('acceptMitigationSuggestion follow-ons', () => {
  test('alt_route acceptance creates a proposed reroute shipment', async () => {
    await makeUser();
    const route = await makeEntity('India-Europe Route', 'route');
    const alert = await makeAlert([route._id]);
    const suggestion = await MitigationSuggestion.create({
      org_id: orgId,
      alert_id: alert._id,
      suggestion_type: 'alt_route',
      narrative: 'Divert around Cape of Good Hope.',
      confidence_pct: 82,
      estimated_var_reduction_usd: 520_000,
      expected_outcome: {
        summary: 'Avoids Red Sea exposure.',
        proposed_route: [{ lat: 18.9, lng: 72.8 }, { lat: -34.3, lng: 18.4 }],
        value_usd: 730_000,
      },
      status: 'proposed',
    });

    const result = await acceptMitigationSuggestion({
      alertId: String(alert._id),
      mitigationId: String(suggestion._id),
      orgId: String(orgId),
      userId: String(userId),
      status: 'accepted',
    });

    expect(result.status).toBe('accepted');
    expect(result.followOn?.type).toBe('shipment');
    const shipment = await Shipment.findOne({ org_id: orgId }).lean();
    expect(shipment?.ref).toContain('MIT-');
    expect(shipment?.route_polyline).toHaveLength(2);
    expect(shipment?.status).toBe('draft');
  });

  test('inventory_buffer acceptance logs a decision and enables VaR digest context', async () => {
    await makeUser();
    const supplier = await makeEntity('Affected Supplier');
    const alert = await makeAlert([supplier._id]);
    const suggestion = await MitigationSuggestion.create({
      org_id: orgId,
      alert_id: alert._id,
      suggestion_type: 'inventory_buffer',
      narrative: 'Build 45 days of buffer stock.',
      confidence_pct: 77,
      estimated_var_reduction_usd: 410_000,
      expected_outcome: { summary: 'Absorbs near-term delay.' },
      status: 'proposed',
    });

    const result = await acceptMitigationSuggestion({
      alertId: String(alert._id),
      mitigationId: String(suggestion._id),
      orgId: String(orgId),
      userId: String(userId),
      status: 'accepted',
    });

    expect(result.followOn?.type).toBe('decision');
    const decision = await Decision.findOne({ org_id: orgId, alert_id: alert._id }).lean();
    expect(decision?.decision_type).toBe('mitigation_chosen');
    expect(decision?.decision_text).toContain('Build 45 days');

    const preference = await DigestPreference.findOne({ org_id: orgId, user_id: userId }).lean();
    expect(preference?.sections).toContain('var_summary');
  });

  test('alt_supplier acceptance creates an inactive watchlist addition suggestion', async () => {
    await makeUser();
    const supplier = await makeEntity('Affected Supplier');
    const alert = await makeAlert([supplier._id]);
    const suggestion = await MitigationSuggestion.create({
      org_id: orgId,
      alert_id: alert._id,
      suggestion_type: 'alt_supplier',
      narrative: 'Qualify Singapore API Backup.',
      confidence_pct: 68,
      estimated_var_reduction_usd: 260_000,
      expected_outcome: { summary: 'Reduces supplier concentration.', supplier_name: 'Singapore API Backup' },
      status: 'proposed',
    });

    const result = await acceptMitigationSuggestion({
      alertId: String(alert._id),
      mitigationId: String(suggestion._id),
      orgId: String(orgId),
      userId: String(userId),
      status: 'accepted',
    });

    expect(result.followOn?.type).toBe('watchlist_entity');
    const entity = await WatchlistEntity.findOne({ org_id: orgId, name: 'Singapore API Backup' }).lean();
    expect(entity?.active).toBe(false);
    expect(entity?.metadata).toMatchObject({ suggested_from_mitigation: true });
  });

  test('contract_clause acceptance creates an inactive contract revision draft', async () => {
    await makeUser();
    const supplier = await makeEntity('Affected Distributor');
    const alert = await makeAlert([supplier._id]);
    const suggestion = await MitigationSuggestion.create({
      org_id: orgId,
      alert_id: alert._id,
      suggestion_type: 'contract_clause',
      narrative: 'Draft force majeure notice clause for Lagos distributor.',
      confidence_pct: 76,
      estimated_var_reduction_usd: 340_000,
      expected_outcome: { summary: 'Preserves notice rights.', clause_text: 'Force majeure notice draft.' },
      status: 'proposed',
    });

    const result = await acceptMitigationSuggestion({
      alertId: String(alert._id),
      mitigationId: String(suggestion._id),
      orgId: String(orgId),
      userId: String(userId),
      status: 'accepted',
    });

    expect(result.followOn?.type).toBe('contract');
    const contract = await Contract.findOne({ org_id: orgId }).lean();
    expect(contract?.active).toBe(false);
    expect(contract?.ref).toContain('DRAFT-MIT-');
    expect(contract?.force_majeure_clauses).toContain('Force majeure notice draft.');
  });
});

import { Types } from 'mongoose';
import {
  Alert,
  Contract,
  Counterparty,
  Decision,
  DigestPreference,
  MitigationSuggestion,
  Shipment,
  WatchlistEntity,
} from '@syntra/db';
import type { MitigationStatus, MitigationSuggestionType } from '@syntra/db';

type FollowOnType = 'shipment' | 'decision' | 'watchlist_entity' | 'contract';

interface AcceptMitigationInput {
  alertId: string;
  mitigationId: string;
  orgId: string;
  userId: string;
  status: Extract<MitigationStatus, 'accepted' | 'rejected'>;
}

interface AcceptMitigationResult {
  id: string;
  status: MitigationStatus;
  followOn: { type: FollowOnType; id: string } | null;
}

interface MitigationOutcome {
  summary?: string;
  proposed_route?: Array<{ lat: number; lng: number }>;
  value_usd?: number;
  supplier_name?: string;
  clause_text?: string;
}

function oid(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

function asOutcome(value: unknown): MitigationOutcome {
  if (!value || typeof value !== 'object') return {};
  return value as MitigationOutcome;
}

function buildDecisionText(type: MitigationSuggestionType, narrative: string): string {
  const labels: Record<MitigationSuggestionType, string> = {
    alt_route: 'Accepted alternative route mitigation',
    alt_supplier: 'Accepted alternative supplier mitigation',
    inventory_buffer: 'Accepted inventory buffer mitigation',
    contract_clause: 'Accepted contract clause mitigation',
  };
  return `${labels[type]}: ${narrative}`;
}

async function writeDecision(params: {
  orgId: Types.ObjectId;
  alertId: Types.ObjectId;
  userId: Types.ObjectId;
  suggestionType: MitigationSuggestionType;
  narrative: string;
  justification: string;
}) {
  return Decision.create({
    org_id: params.orgId,
    alert_id: params.alertId,
    user_id: params.userId,
    decision_type: 'mitigation_chosen',
    decision_text: buildDecisionText(params.suggestionType, params.narrative),
    justification: params.justification,
    made_at: new Date(),
  });
}

async function createShipmentFollowOn(params: {
  orgId: Types.ObjectId;
  alertEntityIds: Types.ObjectId[];
  mitigationId: Types.ObjectId;
  outcome: MitigationOutcome;
  fallbackValueUsd: number | null;
}) {
  const firstEntityId = params.alertEntityIds[0] ?? params.mitigationId;
  const secondEntityId = params.alertEntityIds[1] ?? firstEntityId;

  return Shipment.create({
    org_id: params.orgId,
    ref: `MIT-${String(params.mitigationId).slice(-8).toUpperCase()}`,
    origin_entity_id: firstEntityId,
    destination_entity_id: secondEntityId,
    route_polyline: params.outcome.proposed_route ?? [],
    status: 'draft',
    eta_at: null,
    value_usd: params.outcome.value_usd ?? params.fallbackValueUsd ?? 0,
    active: true,
  });
}

async function ensureVarDigestContext(orgId: Types.ObjectId, userId: Types.ObjectId) {
  await DigestPreference.findOneAndUpdate(
    { org_id: orgId, user_id: userId },
    {
      $setOnInsert: {
        org_id: orgId,
        user_id: userId,
        frequency: 'daily',
        channels: ['email'],
        enabled: true,
      },
      $addToSet: { sections: 'var_summary' },
    },
    { upsert: true, new: true },
  );
}

async function createSupplierFollowOn(params: {
  orgId: Types.ObjectId;
  mitigationId: Types.ObjectId;
  outcome: MitigationOutcome;
}) {
  const name = params.outcome.supplier_name?.trim() || `Mitigation supplier ${String(params.mitigationId).slice(-8)}`;
  return WatchlistEntity.create({
    org_id: params.orgId,
    type: 'supplier',
    name,
    latitude: null,
    longitude: null,
    country_code: null,
    region: null,
    metadata: {
      suggested_from_mitigation: true,
      mitigation_id: String(params.mitigationId),
    },
    active: false,
    annual_revenue_usd: null,
    contribution_pct: null,
  });
}

async function createContractFollowOn(params: {
  orgId: Types.ObjectId;
  alertEntityIds: Types.ObjectId[];
  mitigationId: Types.ObjectId;
  outcome: MitigationOutcome;
}) {
  const clauseText = params.outcome.clause_text?.trim() || params.outcome.summary || 'Mitigation clause draft.';
  const counterparty = await Counterparty.findOne({
    org_id: params.orgId,
    entity_id: { $in: params.alertEntityIds },
    active: true,
  }).lean();

  if (counterparty?.contract_id) {
    await Contract.findOneAndUpdate(
      { _id: counterparty.contract_id, org_id: params.orgId, active: true },
      { $addToSet: { force_majeure_clauses: clauseText } },
    );
  }

  return Contract.create({
    org_id: params.orgId,
    counterparty_id: counterparty?._id ?? params.alertEntityIds[0] ?? params.mitigationId,
    ref: `DRAFT-MIT-${String(params.mitigationId).slice(-8).toUpperCase()}`,
    type: 'supply',
    value_usd: 0,
    expires_at: null,
    terms_summary: params.outcome.summary ?? 'Draft contract revision created from accepted mitigation.',
    force_majeure_clauses: [clauseText],
    active: false,
  });
}

export async function acceptMitigationSuggestion(input: AcceptMitigationInput): Promise<AcceptMitigationResult> {
  const orgId = oid(input.orgId);
  const alertId = oid(input.alertId);
  const mitigationId = oid(input.mitigationId);
  const userId = oid(input.userId);

  const suggestion = await MitigationSuggestion.findOneAndUpdate(
    { _id: mitigationId, alert_id: alertId, org_id: orgId },
    { $set: { status: input.status } },
    { new: true },
  );

  if (!suggestion) {
    throw new Error('Mitigation suggestion not found');
  }

  if (input.status !== 'accepted') {
    return { id: String(suggestion._id), status: suggestion.status, followOn: null };
  }

  const alert = await Alert.findOne({ _id: alertId, org_id: orgId }).lean();
  if (!alert) {
    throw new Error('Alert not found');
  }

  const outcome = asOutcome(suggestion.expected_outcome);
  const decision = await writeDecision({
    orgId,
    alertId,
    userId,
    suggestionType: suggestion.suggestion_type,
    narrative: suggestion.narrative,
    justification: outcome.summary ?? 'Mitigation accepted from generated recommendation.',
  });

  let followOn: AcceptMitigationResult['followOn'] = {
    type: 'decision',
    id: String(decision._id),
  };

  if (suggestion.suggestion_type === 'alt_route') {
    const shipment = await createShipmentFollowOn({
      orgId,
      alertEntityIds: alert.watchlist_entity_ids as Types.ObjectId[],
      mitigationId,
      outcome,
      fallbackValueUsd: suggestion.estimated_var_reduction_usd,
    });
    followOn = { type: 'shipment', id: String(shipment._id) };
  } else if (suggestion.suggestion_type === 'inventory_buffer') {
    await ensureVarDigestContext(orgId, userId);
  } else if (suggestion.suggestion_type === 'alt_supplier') {
    const entity = await createSupplierFollowOn({ orgId, mitigationId, outcome });
    followOn = { type: 'watchlist_entity', id: String(entity._id) };
  } else if (suggestion.suggestion_type === 'contract_clause') {
    const contract = await createContractFollowOn({
      orgId,
      alertEntityIds: alert.watchlist_entity_ids as Types.ObjectId[],
      mitigationId,
      outcome,
    });
    followOn = { type: 'contract', id: String(contract._id) };
  }

  return { id: String(suggestion._id), status: suggestion.status, followOn };
}

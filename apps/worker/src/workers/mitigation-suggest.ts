import { connectDb, Alert, WatchlistEntity, SupplierLink, Exposure, MitigationSuggestion, Scenario } from '@syntra/db';
import { callLLMJson, renderTemplate } from '@syntra/llm';
import { ALT_ROUTE_SUGGESTION } from '../../../../specs/contracts/05-llm-prompts.contract.js';
import { Types } from 'mongoose';
import type { IAlert, IWatchlistEntity, IExposure } from '@syntra/db';

// ---------------------------------------------------------------------------
// BFS: walk SupplierLink graph up to depth 3, collecting alternative peers
// (siblings of affected nodes = potential alt suppliers)
// ---------------------------------------------------------------------------

interface GraphNode {
  entityId: string;
  depth: number;
}

async function bfsSupplierGraph(
  orgId: Types.ObjectId,
  rootEntityIds: string[],
  maxDepth: number = 3,
): Promise<{ alternatives: IWatchlistEntity[]; affected: string[] }> {
  // Walk upstream only: from affected entities, find their parents (and parents' parents)
  // This avoids marking siblings as affected.
  const allAffected = new Set<string>(rootEntityIds);
  const visited = new Set<string>(rootEntityIds);
  const queue: GraphNode[] = rootEntityIds.map(id => ({ entityId: id, depth: 0 }));

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.depth >= maxDepth) continue;

    // Go upstream: find parents of current entity
    const parentLinks = await SupplierLink.find({
      org_id: orgId,
      child_entity_id: new Types.ObjectId(node.entityId),
    }).lean();

    for (const link of parentLinks) {
      const parentStr = String(link.parent_entity_id);
      if (!visited.has(parentStr)) {
        visited.add(parentStr);
        allAffected.add(parentStr);
        queue.push({ entityId: parentStr, depth: node.depth + 1 });
      }
    }
  }

  // Alternatives = entities that share a parent with any affected entity but are not affected
  const parentIds = await SupplierLink.find({
    org_id: orgId,
    child_entity_id: { $in: [...allAffected].map(id => new Types.ObjectId(id)) },
  }).distinct('parent_entity_id');

  const siblingLinks = await SupplierLink.find({
    org_id: orgId,
    parent_entity_id: { $in: parentIds },
    child_entity_id: { $nin: [...allAffected].map(id => new Types.ObjectId(id)) },
  }).lean();

  const siblingIds = [...new Set(siblingLinks.map(l => String(l.child_entity_id)))];
  const alternatives = await WatchlistEntity.find({
    _id: { $in: siblingIds.map(id => new Types.ObjectId(id)) },
    active: true,
    type: { $in: ['supplier', 'port'] },
  }).lean() as unknown as IWatchlistEntity[];

  return { alternatives, affected: [...allAffected] };
}

// ---------------------------------------------------------------------------
// LLM call with mock fallback
// ---------------------------------------------------------------------------

interface AltRouteLLMOutput {
  alternatives: Array<{
    route_name: string;
    via: string;
    extra_days: number;
    cost_delta_pct: number | null;
    risk_notes: string;
  }>;
  narrative: string;
}

async function callAltRouteLLM(
  alert: IAlert,
  routeEntity: IWatchlistEntity | undefined,
): Promise<AltRouteLLMOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    const { generateAltRouteSuggestion } = await import('@syntra/shared/mocks/anthropic.js');
    return generateAltRouteSuggestion(alert.event_snapshot.title);
  }

  const waypoints = (routeEntity?.metadata as { waypoints?: Array<{ lat: number; lng: number }> })?.waypoints ?? [];
  const vars = {
    disrupted_route_name: routeEntity?.name ?? alert.event_snapshot.country,
    disrupted_route_waypoints: JSON.stringify(waypoints),
    origin_port:  waypoints.length > 0 ? `${waypoints[0].lat},${waypoints[0].lng}` : 'unknown',
    destination_port: waypoints.length > 1 ? `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}` : 'unknown',
    cargo_type: 'general cargo',
    event_title: alert.event_snapshot.title,
  };

  const userMessage = renderTemplate(ALT_ROUTE_SUGGESTION.template, vars);

  const raw = await callLLMJson<AltRouteLLMOutput>(
    ALT_ROUTE_SUGGESTION.model,
    ALT_ROUTE_SUGGESTION.system ?? '',
    userMessage,
  );

  // Zod validate
  const parsed = ALT_ROUTE_SUGGESTION.expected_output_format.safeParse(raw);
  if (!parsed.success) {
    console.warn('[mitigation-suggest] LLM output failed Zod validation, using raw:', parsed.error.issues[0]);
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Compute estimated VaR reduction from accepting a mitigation
// ---------------------------------------------------------------------------

function estimateVarReduction(exposures: IExposure[]): number {
  const total = exposures.reduce((sum, e) => sum + e.var_value_usd, 0);
  // Conservative: alt route/supplier typically absorbs 30-60% of the risk
  return Math.round(total * 0.4);
}

// ---------------------------------------------------------------------------
// Main function — called by dispatch worker or cron for high/critical alerts
// ---------------------------------------------------------------------------

export interface MitigationRunResult {
  alertId: string;
  suggestionsCreated: number;
  scenarioTriggered: boolean;
}

export async function runMitigationSuggest(alertId: string): Promise<MitigationRunResult> {
  await connectDb();

  const alert = await Alert.findById(alertId).lean() as unknown as IAlert | null;
  if (!alert) throw new Error(`Alert ${alertId} not found`);
  if (!['high', 'critical'].includes(alert.severity)) {
    return { alertId, suggestionsCreated: 0, scenarioTriggered: false };
  }

  // Skip if suggestions already exist for this alert
  const existing = await MitigationSuggestion.countDocuments({ alert_id: alert._id });
  if (existing > 0) return { alertId, suggestionsCreated: 0, scenarioTriggered: false };

  const entities = await WatchlistEntity.find({
    _id: { $in: alert.watchlist_entity_ids },
    active: true,
  }).lean() as unknown as IWatchlistEntity[];

  const { alternatives, affected } = await bfsSupplierGraph(
    alert.org_id as unknown as Types.ObjectId,
    alert.watchlist_entity_ids.map(String),
  );

  const exposures = await Exposure.find({
    alert_id: alert._id,
    org_id: alert.org_id,
  }).lean() as unknown as IExposure[];

  const routeEntities = entities.filter(e => e.type === 'route');
  const routeEntity = routeEntities[0];
  const estimatedReduction = estimateVarReduction(exposures);

  const created: string[] = [];

  // 1. Alt route suggestion (if route entities affected or event is a route disruption)
  if (routeEntity || alert.match_reasons.includes('route')) {
    const llmOutput = await callAltRouteLLM(alert, routeEntity);
    const narrative = llmOutput.narrative + (llmOutput.alternatives.length > 0
      ? '\n\nAlternative options: ' + llmOutput.alternatives.map(a =>
          `${a.route_name} via ${a.via} (+${a.extra_days}d${a.cost_delta_pct !== null ? `, ${a.cost_delta_pct > 0 ? '+' : ''}${a.cost_delta_pct}% cost` : ''})`
        ).join('; ')
      : '');

    const sources = alert.event_snapshot.sources.map(s => s.url);
    const doc = await MitigationSuggestion.create({
      org_id:   alert.org_id,
      alert_id: alert._id,
      suggestion_type: 'alt_route',
      narrative,
      confidence_pct: 72,
      estimated_var_reduction_usd: estimatedReduction > 0 ? estimatedReduction : null,
      sources,
      status: 'proposed',
    });
    created.push(String(doc._id));
  }

  // 2. Alt supplier suggestion (if tier-1/2 alternatives found in graph walk)
  if (alternatives.length > 0) {
    const altNames = alternatives.slice(0, 3).map(a => a.name).join(', ');
    const doc = await MitigationSuggestion.create({
      org_id:   alert.org_id,
      alert_id: alert._id,
      suggestion_type: 'alt_supplier',
      narrative: `Based on your supplier graph, ${alternatives.length} potential alternative supplier${alternatives.length !== 1 ? 's' : ''} identified within 2-tier network: ${altNames}. Consider activating contingency contracts with these parties.`,
      confidence_pct: 65,
      estimated_var_reduction_usd: estimatedReduction > 0 ? Math.round(estimatedReduction * 0.6) : null,
      sources: [],
      status: 'proposed',
    });
    created.push(String(doc._id));
  }

  // 3. Inventory buffer suggestion (for high severity)
  if (alert.severity === 'critical' || alert.severity === 'high') {
    const doc = await MitigationSuggestion.create({
      org_id:   alert.org_id,
      alert_id: alert._id,
      suggestion_type: 'inventory_buffer',
      narrative: `Consider pre-positioning 30–60 days of safety stock for goods sourced from affected entities (${entities.map(e => e.name).join(', ')}). This hedges against potential supply disruption of 4–8 weeks indicated by the event severity.`,
      confidence_pct: 80,
      estimated_var_reduction_usd: estimatedReduction > 0 ? Math.round(estimatedReduction * 0.35) : null,
      sources: [],
      status: 'proposed',
    });
    created.push(String(doc._id));
  }

  // Trigger alternative Scenario via M19 queue if estimated reduction is meaningful (> $10K)
  let scenarioTriggered = false;
  if (estimatedReduction > 10_000) {
    const affectedEntityOids = affected.map(id => new Types.ObjectId(id));
    const scenario = await Scenario.create({
      org_id:      alert.org_id,
      name:        `Mitigation scenario for: ${alert.event_snapshot.title.slice(0, 100)}`,
      description: `Auto-generated by M22 mitigation engine. Alert ${alertId}. Tests impact if mitigations are adopted.`,
      hypothesis_events: [{
        type:     alert.subtype ?? 'physical_risk',
        geo:      alert.event_snapshot.country_code ?? alert.event_snapshot.country,
        severity: alert.severity,
      }],
      affected_entity_ids: affectedEntityOids,
      computed_var_total_usd: null,
      computed_at: null,
      created_by: alert.org_id,
    });

    const { getScenarioComputeQueue } = await import('./scenario-compute.js');
    await getScenarioComputeQueue().add('compute', { scenarioId: String(scenario._id) });
    scenarioTriggered = true;
    console.log(`[mitigation-suggest] Triggered scenario ${String(scenario._id)} for alert ${alertId}`);
  }

  console.log(`[mitigation-suggest] alert ${alertId}: ${created.length} suggestions created, scenario=${scenarioTriggered}`);
  return { alertId, suggestionsCreated: created.length, scenarioTriggered };
}

import { WatchlistEntity } from '../models/WatchlistEntity.js';
import { SupplierLink } from '../models/SupplierLink.js';
import type { HypothesisEvent } from '../models/Scenario.js';
import { Types } from 'mongoose';

const MAX_TIER = 3;

// VaR disruption factor table (mirrors @syntra/shared/utils/var-table — kept local to avoid cross-package TS resolution)
type AlertKind     = 'physical_risk' | 'sanctions_match' | 'compliance';
type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

const VAR_FACTORS: Record<AlertKind, Record<AlertSeverity, number>> = {
  physical_risk:   { critical: 0.35, high: 0.22, medium: 0.12, low: 0.05, info: 0.01 },
  sanctions_match: { critical: 0.90, high: 0.75, medium: 0.55, low: 0.30, info: 0.10 },
  compliance:      { critical: 0.40, high: 0.25, medium: 0.15, low: 0.07, info: 0.02 },
};

function getDisruptionFactor(kind: string, severity: string): number {
  return (VAR_FACTORS as Record<string, Record<string, number>>)[kind]?.[severity] ?? 0.01;
}

function computeVarUsd(revenue: number | null, pct: number | null, factor: number): number {
  if (!revenue || !pct) return 0;
  return revenue * (pct / 100) * factor;
}

export interface ScenarioComputeResult {
  affected_entity_ids: string[];
  computed_var_total_usd: number;
  entity_var_map: Record<string, number>;
}

/**
 * Propagate hypothesis events through the SupplierLink graph and aggregate VaR.
 * Pure logic — no side-effects; caller is responsible for persisting results.
 */
export async function computeScenario(
  orgId: Types.ObjectId | string,
  hypothesisEvents: HypothesisEvent[],
): Promise<ScenarioComputeResult> {
  const orgObjectId = typeof orgId === 'string' ? new Types.ObjectId(orgId) : orgId;
  const entityVarMap = new Map<string, number>();

  for (const event of hypothesisEvents) {
    const { type, geo, severity } = event;
    const disruptionFactor = getDisruptionFactor(type, severity);

    const directEntities = await WatchlistEntity.find({
      org_id: orgObjectId,
      active: true,
      $or: [
        { country_code: geo.toUpperCase() },
        { region: { $regex: new RegExp(`^${geo}$`, 'i') } },
        { name:   { $regex: new RegExp(geo, 'i') } },
      ],
    }).lean();

    if (directEntities.length === 0) continue;

    const visited = new Set<string>(directEntities.map(e => String(e._id)));
    const bfsQueue: Array<{ id: string; depth: number }> = directEntities.map(e => ({
      id: String(e._id),
      depth: 0,
    }));
    const allAffectedIds = new Set<string>(visited);

    while (bfsQueue.length > 0) {
      const item = bfsQueue.shift()!;
      if (item.depth >= MAX_TIER) continue;

      const links = await SupplierLink.find({
        org_id: orgObjectId,
        child_entity_id: new Types.ObjectId(item.id),
      }).lean();

      for (const link of links) {
        const parentId = String(link.parent_entity_id);
        if (visited.has(parentId)) continue;
        visited.add(parentId);
        allAffectedIds.add(parentId);
        bfsQueue.push({ id: parentId, depth: item.depth + 1 });
      }
    }

    const affectedEntities = await WatchlistEntity.find({
      _id: { $in: Array.from(allAffectedIds).map(id => new Types.ObjectId(id)) },
      org_id: orgObjectId,
      active: true,
    }).lean();

    for (const entity of affectedEntities) {
      const varUsd = computeVarUsd(
        entity.annual_revenue_usd ?? null,
        entity.contribution_pct ?? null,
        disruptionFactor,
      );
      const key = String(entity._id);
      if (varUsd > (entityVarMap.get(key) ?? 0)) entityVarMap.set(key, varUsd);
    }
  }

  const entity_var_map: Record<string, number> = {};
  for (const [k, v] of entityVarMap) entity_var_map[k] = v;

  return {
    affected_entity_ids:    Array.from(entityVarMap.keys()),
    computed_var_total_usd: Array.from(entityVarMap.values()).reduce((s, v) => s + v, 0),
    entity_var_map,
  };
}

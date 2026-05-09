import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Scenario, WatchlistEntity, Exposure } from '@syntra/db';
import { ScenarioBuilder } from '@/components/scenario/ScenarioBuilder';
import type { IScenario, IWatchlistEntity, IExposure } from '@syntra/db';

interface PageProps { params: { orgSlug: string; id: string } }

export default async function ScenarioDetailPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const scenario = await Scenario.findOne({ _id: params.id, org_id: org._id }).lean() as unknown as IScenario | null;
  if (!scenario) notFound();

  // Fetch affected entity details for the initial render
  const entityIds = scenario.affected_entity_ids ?? [];
  const entityDocs = entityIds.length > 0
    ? await WatchlistEntity.find({ _id: { $in: entityIds } }).lean() as unknown as IWatchlistEntity[]
    : [];

  // Build entity → latest VaR map from Exposure records
  const exposureDocs = entityIds.length > 0
    ? await Exposure.find({ org_id: org._id, entity_id: { $in: entityIds } })
        .sort({ computed_at: -1 })
        .lean() as unknown as IExposure[]
    : [];

  const latestVarByEntity = new Map<string, number>();
  for (const exp of exposureDocs) {
    const key = String(exp.entity_id);
    if (!latestVarByEntity.has(key)) latestVarByEntity.set(key, exp.var_value_usd);
  }

  const entityVarMap: Record<string, number> = {};
  for (const [k, v] of latestVarByEntity) entityVarMap[k] = v;

  // Baseline VaR: sum of all open-alert entity exposures for this org
  const allExposures = await Exposure.find({ org_id: org._id })
    .sort({ computed_at: -1 })
    .lean() as unknown as IExposure[];

  const baselineEntityMap = new Map<string, number>();
  for (const exp of allExposures) {
    const key = String(exp.entity_id);
    if (!baselineEntityMap.has(key)) baselineEntityMap.set(key, exp.var_value_usd);
  }
  const baselineVarUsd = Array.from(baselineEntityMap.values()).reduce((s, v) => s + v, 0);

  const entityNameMap = new Map(entityDocs.map(e => [String(e._id), e.name]));

  const initialEntities = entityIds.map(id => {
    const key = String(id);
    return {
      id:     key,
      name:   entityNameMap.get(key) ?? key,
      varUsd: entityVarMap[key] ?? 0,
    };
  });

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1.5 text-sm" style={{ color: '#64748B' }}>
        <Link
          href={`/app/${params.orgSlug}/scenarios`}
          className="transition-colors"
          style={{ color: '#94A3B8', transitionDuration: '150ms' }}
        >
          Scenarios
        </Link>
        <ChevronRight size={14} />
        <span className="truncate max-w-sm" style={{ color: '#94A3B8' }}>{scenario.name}</span>
      </nav>

      <div>
        <h1 className="text-xl font-semibold" style={{ color: '#FAFAFA' }}>{scenario.name}</h1>
        {scenario.description && (
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>{scenario.description}</p>
        )}
      </div>

      <ScenarioBuilder
        scenarioId={String(scenario._id)}
        orgSlug={params.orgSlug}
        initialEvents={scenario.hypothesis_events}
        baselineVarUsd={baselineVarUsd}
        initialEntities={initialEntities}
        initialVarTotal={scenario.computed_var_total_usd}
      />
    </div>
  );
}

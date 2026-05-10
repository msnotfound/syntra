import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Contract, Counterparty, WatchlistEntity } from '@syntra/db';
import type { IContract, ICounterparty } from '@syntra/db';
import { Provenance } from '@/components/intel/Provenance';
import { SourceBadge } from '@/components/intel/SourceBadge';
import type { ProvenanceClaim } from '@/components/intel/ProvenanceTrail';
import { ReExtractButton } from './ReExtractButton';

interface PageProps {
  params: { orgSlug: string; id: string };
  searchParams: { tab?: string };
}

const TABS = ['obligations', 'key_dates', 'value_clauses', 'risk_clauses'] as const;

export default async function ContractDetailPage({ params, searchParams }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);
  const contract = await Contract.findOne({ _id: params.id, org_id: org._id }).lean() as unknown as IContract | null;
  if (!contract) notFound();

  const extracted = contract.extracted ?? {
    counterparties: [],
    obligations: [],
    key_dates: [],
    value_clauses: [],
    force_majeure: { covered: contract.force_majeure_clauses.length > 0, excerpt: contract.force_majeure_clauses[0] ?? null },
    exclusivity: { exclusive: false, scope: null, geographies: [] },
  };
  const extractedCounterpartyEntityIds = extracted.counterparties
    .map(cp => cp.entity_id)
    .filter(Boolean)
    .map(String) ?? [];
  const [counterparty, linkedEntities, linkedCounterparties] = await Promise.all([
    Counterparty.findById(contract.counterparty_id).lean() as Promise<ICounterparty | null>,
    WatchlistEntity.find({ _id: { $in: extractedCounterpartyEntityIds } }).select('name').lean(),
    Counterparty.find({ org_id: org._id, entity_id: { $in: extractedCounterpartyEntityIds } }).select('entity_id').lean(),
  ]);
  const primaryEntity = counterparty ? await WatchlistEntity.findById(counterparty.entity_id).lean() : null;
  const entityNameById = new Map(linkedEntities.map(entity => [String(entity._id), entity.name]));
  const counterpartyByEntityId = new Map(linkedCounterparties.map(cp => [String(cp.entity_id), String(cp._id)]));

  const base = `/app/${params.orgSlug}/operations`;
  const tab = TABS.includes(searchParams.tab as typeof TABS[number])
    ? searchParams.tab as typeof TABS[number]
    : 'obligations';
  const claims = provenanceClaims(contract);
  const totalValue = extracted.value_clauses.find(v => v.amount_usd !== null)?.amount_usd ?? contract.value_usd;
  const expiry = extracted.key_dates.find(date => date.type === 'expiry')?.date ?? contract.expires_at;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-text-muted">
          <Link href={base} className="transition-colors duration-[150ms] hover:text-text-secondary">Operations</Link>
          <span>/</span>
          <Link href={`${base}/contracts`} className="transition-colors duration-[150ms] hover:text-text-secondary">Contracts</Link>
          <span>/</span>
          <span className="font-mono text-text-secondary">{contract.ref}</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-xl font-semibold text-text-primary">{contract.ref}</h1>
              <SourceBadge admiralty_code="B" reliability_pct={contract.extraction_confidence_pct || 78} source_name="LLM contract extraction" />
            </div>
            <p className="mt-1 text-sm text-text-secondary">{primaryEntity ? (primaryEntity as { name: string }).name : 'Contract counterparty'} · {contract.type}</p>
          </div>
          <ReExtractButton contractId={String(contract._id)} docUrl={contract.source_doc_url} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="Value" value={`$${totalValue.toLocaleString()}`} />
        <Metric label="Expiry" value={expiry ? new Date(expiry).toLocaleDateString() : '—'} />
        <Metric label="Extraction" value={contract.extracted_at ? `${contract.extraction_confidence_pct}% confidence` : 'Not extracted'} />
      </div>

      <section className="rounded-md border border-border-subtle bg-bg-surface">
        <div className="border-b border-border-subtle px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">Counterparties</h2>
        </div>
        <div className="divide-y divide-border-subtle">
          {extracted.counterparties.length === 0 ? (
            <p className="px-4 py-5 text-sm text-text-muted">No extracted counterparties.</p>
          ) : extracted.counterparties.map(cp => (
            <div key={`${cp.name}:${cp.role}`} className="flex items-center justify-between px-4 py-3">
              <div>
                <Provenance claims={claims} context={`Counterparty ${cp.name}`}>
                  <span className="text-sm text-text-primary">{cp.name}</span>
                </Provenance>
                <p className="mt-0.5 text-xs capitalize text-text-muted">{cp.role}</p>
              </div>
              {cp.entity_id ? (
                <Link href={`${base}/counterparties/${counterpartyByEntityId.get(String(cp.entity_id)) ?? String(contract.counterparty_id)}`} className="font-mono text-xs text-accent hover:underline">
                  {entityNameById.get(String(cp.entity_id)) ?? String(cp.entity_id).slice(-8)}
                </Link>
              ) : (
                <span className="text-xs text-text-disabled">Unlinked</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-1 border-b border-border-subtle">
        {TABS.map(item => (
          <Link
            key={item}
            href={`${base}/contracts/${String(contract._id)}?tab=${item}`}
            className={`px-3 py-2 text-xs font-medium capitalize transition-colors duration-[150ms] ${tab === item ? 'border-b border-accent text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
          >
            {item.replace('_', ' ')}
          </Link>
        ))}
      </div>

      {tab === 'obligations' && (
        <ItemList
          empty="No extracted obligations."
          items={extracted.obligations.map(item => ({
            key: `${item.party}:${item.description}`,
            title: item.party,
            meta: `${item.status}${item.due_date ? ` · due ${new Date(item.due_date).toLocaleDateString()}` : ''}`,
            body: item.description,
          }))}
          claims={claims}
        />
      )}
      {tab === 'key_dates' && (
        <ItemList
          empty="No extracted key dates."
          items={extracted.key_dates.map(item => ({
            key: `${item.label}:${item.date}`,
            title: item.label,
            meta: `${item.type} · ${new Date(item.date).toLocaleDateString()}`,
            body: `Contract date classified as ${item.type}.`,
          }))}
          claims={claims}
        />
      )}
      {tab === 'value_clauses' && (
        <ItemList
          empty="No extracted value clauses."
          items={extracted.value_clauses.map(item => ({
            key: item.description,
            title: item.amount_usd === null ? item.currency : `${item.currency} ${item.amount_usd.toLocaleString()}`,
            meta: item.trigger ?? 'No trigger extracted',
            body: item.description,
          }))}
          claims={claims}
        />
      )}
      {tab === 'risk_clauses' && (
        <div className="grid gap-3 md:grid-cols-2">
          <RiskClause title="Force majeure" active={extracted.force_majeure.covered} body={extracted.force_majeure.excerpt ?? 'No force majeure excerpt extracted.'} claims={claims} />
          <RiskClause title="Exclusivity" active={extracted.exclusivity.exclusive} body={extracted.exclusivity.scope ?? 'No exclusivity scope extracted.'} meta={extracted.exclusivity.geographies.join(', ')} claims={claims} />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-surface px-4 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm text-text-primary">{value}</p>
    </div>
  );
}

function ItemList({
  items,
  empty,
  claims,
}: {
  items: Array<{ key: string; title: string; meta: string; body: string }>;
  empty: string;
  claims: ProvenanceClaim[];
}) {
  if (items.length === 0) return <p className="text-sm text-text-muted">{empty}</p>;
  return (
    <div className="rounded-md border border-border-subtle bg-bg-surface">
      {items.map(item => (
        <div key={item.key} className="border-b border-border-subtle px-4 py-3 last:border-b-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-text-primary">{item.title}</p>
            <p className="font-mono text-xs text-text-muted">{item.meta}</p>
          </div>
          <div className="mt-2 flex items-start gap-2">
            <SourceBadge admiralty_code="B" reliability_pct={78} source_name="LLM contract extraction" />
            <Provenance claims={claims} context={item.title}>
              <span className="text-sm leading-relaxed text-text-secondary">{item.body}</span>
            </Provenance>
          </div>
        </div>
      ))}
    </div>
  );
}

function RiskClause({
  title,
  active,
  body,
  meta,
  claims,
}: {
  title: string;
  active: boolean;
  body: string;
  meta?: string;
  claims: ProvenanceClaim[];
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-surface px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <span className={`rounded border px-2 py-0.5 text-xs ${active ? 'border-amber-400/30 text-amber-400' : 'border-border-subtle text-text-muted'}`}>
          {active ? 'Present' : 'Not found'}
        </span>
      </div>
      {meta && <p className="mb-2 font-mono text-xs text-text-muted">{meta}</p>}
      <div className="flex items-start gap-2">
        <SourceBadge admiralty_code="B" reliability_pct={78} source_name="LLM contract extraction" />
        <Provenance claims={claims} context={title}>
          <span className="text-sm leading-relaxed text-text-secondary">{body}</span>
        </Provenance>
      </div>
    </div>
  );
}

function provenanceClaims(contract: IContract): ProvenanceClaim[] {
  if (!contract.source_doc_url) return [];
  return [{
    claim_id: String(contract._id),
    claim_text: contract.terms_summary || `Contract extraction for ${contract.ref}`,
    claim_type: 'fact',
    evidence_url: contract.source_doc_url,
    asserted_at: contract.extracted_at ?? contract.updated_at,
    source: {
      source_id: 'llm-contract-extract',
      source_name: 'LLM contract extraction',
      admiralty_code: 'B',
      reliability_pct: contract.extraction_confidence_pct || 78,
    },
    parent_claim_ids: [],
    depth: 0,
  }];
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { Asset } from '@syntra/db';
import type { IAsset } from '@syntra/db';

interface PageProps { params: { orgSlug: string; id: string } }

const CRITICALITY_COLOR: Record<string, string> = {
  critical: 'text-severity-critical bg-severity-critical/10',
  high:     'text-severity-high bg-severity-high/10',
  medium:   'text-severity-medium bg-severity-medium/10',
  low:      'text-severity-low bg-severity-low/10',
};

export default async function AssetDetailPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);
  const asset = await Asset.findOne({ _id: params.id, org_id: org._id }).lean() as unknown as IAsset | null;
  if (!asset) notFound();

  const base = `/app/${params.orgSlug}/operations`;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-sm text-text-muted mb-1">
          <Link href={base} className="hover:text-text-secondary transition-colors duration-[150ms]">Operations</Link>
          <span>/</span>
          <Link href={`${base}/assets`} className="hover:text-text-secondary transition-colors duration-[150ms]">Assets</Link>
          <span>/</span>
          <span className="text-text-secondary font-mono">{String(asset._id).slice(-8)}</span>
        </div>
        <div className="flex items-start justify-between">
          <h1 className="text-xl font-semibold text-text-primary">{asset.name}</h1>
          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${CRITICALITY_COLOR[asset.criticality] ?? 'text-text-secondary'}`}>
            {asset.criticality}
          </span>
        </div>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-md divide-y divide-border-subtle">
        {[
          { label: 'ID',          value: String(asset._id), mono: true },
          { label: 'Kind',        value: asset.kind,        mono: false },
          { label: 'Criticality', value: asset.criticality, mono: false },
          { label: 'Value (USD)', value: `$${asset.value_usd.toLocaleString()}`, mono: true },
          { label: 'Location',    value: asset.location_geo ? `${asset.location_geo.lat.toFixed(4)}, ${asset.location_geo.lng.toFixed(4)}` : '—', mono: true },
          { label: 'Created',     value: new Date(asset.created_at).toISOString(), mono: true },
          { label: 'Updated',     value: new Date(asset.updated_at).toISOString(), mono: true },
        ].map(row => (
          <div key={row.label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-text-muted">{row.label}</span>
            <span className={`text-sm text-text-primary capitalize ${row.mono ? 'font-mono' : ''}`}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

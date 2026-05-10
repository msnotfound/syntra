import Link from 'next/link';
import { Lightbulb } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { MitigationSuggestion, Alert } from '@syntra/db';
import { TimeAgo } from '@syntra/ui/components/TimeAgo';
import type { IMitigationSuggestion, IAlert } from '@syntra/db';

interface PageProps {
  params: { orgSlug: string };
  searchParams: { status?: string };
}

const TYPE_LABEL: Record<string, string> = {
  alt_route: 'Alt Route',
  alt_supplier: 'Alt Supplier',
  inventory_buffer: 'Inventory Buffer',
  contract_clause: 'Contract Clause',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  proposed: { bg: '#1E2530', text: '#94A3B8' },
  accepted: { bg: 'rgba(34,197,94,0.1)', text: '#22C55E' },
  rejected: { bg: 'rgba(239,68,68,0.1)', text: '#EF4444' },
};

function formatUsd(val: number | null) {
  if (val === null || val === 0) return null;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export default async function MitigationsPage({ params, searchParams }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const query: Record<string, unknown> = { org_id: org._id };
  if (searchParams.status && ['proposed', 'accepted', 'rejected'].includes(searchParams.status)) {
    query.status = searchParams.status;
  }

  const suggestions = await MitigationSuggestion.find(query)
    .sort({ created_at: -1 })
    .limit(100)
    .lean() as unknown as IMitigationSuggestion[];

  const alertIds = [...new Set(suggestions.map(s => String(s.alert_id)))];
  const alerts = await Alert.find({ _id: { $in: alertIds }, org_id: org._id })
    .lean() as unknown as IAlert[];
  const alertMap = new Map(alerts.map(a => [String(a._id), a]));

  const counts = {
    all:      await MitigationSuggestion.countDocuments({ org_id: org._id }),
    proposed: await MitigationSuggestion.countDocuments({ org_id: org._id, status: 'proposed' }),
    accepted: await MitigationSuggestion.countDocuments({ org_id: org._id, status: 'accepted' }),
    rejected: await MitigationSuggestion.countDocuments({ org_id: org._id, status: 'rejected' }),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: '#FAFAFA' }}>Mitigations</h1>
        <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
          {counts.all} total · {counts.proposed} proposed · {counts.accepted} accepted
        </p>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2">
        {(['', 'proposed', 'accepted', 'rejected'] as const).map(s => {
          const label = s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1);
          const count = s === '' ? counts.all : counts[s];
          const isActive = (searchParams.status ?? '') === s;
          return (
            <Link
              key={s}
              href={s === '' ? `/app/${params.orgSlug}/mitigations` : `/app/${params.orgSlug}/mitigations?status=${s}`}
              className="flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium border transition-colors duration-[150ms] ease-out"
              style={{
                backgroundColor: isActive ? '#262C36' : '#1E2530',
                borderColor: isActive ? '#3B82F6' : '#262C36',
                color: isActive ? '#FAFAFA' : '#94A3B8',
              }}
            >
              {label}
              <span className="font-mono" style={{ color: '#64748B' }}>{count}</span>
            </Link>
          );
        })}
      </div>

      {suggestions.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-md border"
          style={{ borderColor: '#1E2530', backgroundColor: '#151921' }}
        >
          <Lightbulb size={32} style={{ color: '#475569' }} />
          <p className="mt-3 text-sm font-medium" style={{ color: '#94A3B8' }}>No mitigations yet</p>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>
            Suggestions are generated automatically for high and critical alerts.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions.map(s => {
            const alert = alertMap.get(String(s.alert_id));
            const sc = STATUS_COLORS[s.status] ?? STATUS_COLORS.proposed;
            const varReduction = formatUsd(s.estimated_var_reduction_usd);
            return (
              <div
                key={String(s._id)}
                className="flex items-start gap-4 px-4 py-3 rounded-md border"
                style={{ backgroundColor: '#151921', borderColor: '#1E2530' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs font-medium px-2 py-0.5"
                      style={{ backgroundColor: '#1E2530', color: '#94A3B8', borderRadius: '4px' }}
                    >
                      {TYPE_LABEL[s.suggestion_type] ?? s.suggestion_type}
                    </span>
                    <span
                      className="text-xs font-medium px-2 py-0.5"
                      style={{ backgroundColor: sc.bg, color: sc.text, borderRadius: '4px' }}
                    >
                      {s.status}
                    </span>
                    {varReduction && (
                      <span className="text-xs font-mono" style={{ color: '#22C55E' }}>
                        ~{varReduction} VaR reduction
                      </span>
                    )}
                  </div>
                  <p className="text-sm truncate" style={{ color: '#FAFAFA' }}>{s.narrative}</p>
                  {alert && (
                    <div className="mt-1">
                      <Link
                        href={`/app/${params.orgSlug}/alerts/${String(alert._id)}`}
                        className="text-xs transition-colors duration-[150ms] ease-out hover:underline"
                        style={{ color: '#3B82F6' }}
                      >
                        {alert.event_snapshot.title}
                      </Link>
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-xs font-mono" style={{ color: '#64748B' }}>
                    {s.confidence_pct}% confidence
                  </div>
                  <TimeAgo date={new Date(s.created_at)} className="text-xs font-mono" style={{ color: '#64748B' } as React.CSSProperties} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

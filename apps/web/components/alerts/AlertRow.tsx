'use client';
import Link from 'next/link';
import { clsx } from 'clsx';
import { SeverityBadge } from '@syntra/ui/components/SeverityBadge';
import { EntityChip } from '@syntra/ui/components/EntityChip';
import { TimeAgo } from '@syntra/ui/components/TimeAgo';
import type { EntityType, Severity } from '@syntra/shared';

interface AffectedEntity {
  id: string;
  type: EntityType;
  name: string;
}

interface AlertRowProps {
  id: string;
  orgSlug: string;
  severity: Severity;
  title: string;
  country: string;
  occurredAt: Date;
  affectedEntities: AffectedEntity[];
  acknowledgedAt?: Date | null;
  acknowledgedByName?: string | null;
  onAcknowledge?: (id: string) => void;
}

const SEVERITY_BORDER: Record<Severity, string> = {
  critical: 'severity-border-critical',
  high:     'severity-border-high',
  medium:   'severity-border-medium',
  low:      'severity-border-low',
  info:     'severity-border-info',
};

export function AlertRow({
  id, orgSlug, severity, title, country, occurredAt,
  affectedEntities, acknowledgedAt, acknowledgedByName, onAcknowledge,
}: AlertRowProps) {
  return (
    <div
      className={clsx('group bg-bg-surface hover:bg-bg-surface-2 transition-colors duration-quick ease-out border-b border-border-subtle', SEVERITY_BORDER[severity])}
    >
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <SeverityBadge severity={severity} />
            </div>
            <div className="text-sm font-medium text-text-primary mb-1 truncate">{title}</div>
            <div className="flex items-center gap-2 text-sm text-text-secondary mb-2">
              <span>{country}</span>
              <span className="text-text-muted">·</span>
              <TimeAgo date={occurredAt} className="text-text-muted font-mono text-xs" />
            </div>
            {affectedEntities.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-text-muted">Affects:</span>
                {affectedEntities.slice(0, 4).map(e => (
                  <EntityChip key={e.id} type={e.type} name={e.name} />
                ))}
              </div>
            )}
            {acknowledgedAt && (
              <div className="mt-1 text-xs text-text-muted flex items-center gap-1">
                <span className="text-success">✓</span>
                <span>Acknowledged{acknowledgedByName ? ` by ${acknowledgedByName}` : ''} · </span>
                <TimeAgo date={acknowledgedAt} className="font-mono" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-[150ms] flex-shrink-0">
            {!acknowledgedAt && onAcknowledge && (
              <button
                onClick={() => onAcknowledge(id)}
                className="px-3 h-7 rounded-md text-xs font-medium text-text-secondary bg-bg-surface-3 border border-border-default hover:text-text-primary hover:border-border-strong transition-colors duration-[150ms] ease-out active:scale-95"
              >
                Ack
              </button>
            )}
            <Link
              href={`/app/${orgSlug}/alerts/${id}`}
              className="px-3 h-7 rounded-md text-xs font-medium text-text-secondary bg-bg-surface-3 border border-border-default hover:text-text-primary hover:border-border-strong transition-colors duration-[150ms] ease-out active:scale-95 flex items-center"
            >
              View →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

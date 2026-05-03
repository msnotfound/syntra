import { clsx } from 'clsx';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  className?: string;
}

export function StatCard({ label, value, sub, className }: StatCardProps) {
  return (
    <div className={clsx('bg-bg-surface border border-border-subtle rounded-md p-4', className)}>
      <div className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-2">{label}</div>
      <div className="text-2xl font-semibold text-text-primary font-mono tabular-nums">{value}</div>
      {sub && <div className="text-xs text-text-muted mt-1">{sub}</div>}
    </div>
  );
}

import { ensureDb } from '@/lib/db';
import { Organization, Alert, Subscription } from '@syntra/db';

export default async function AdminDashboardPage() {
  await ensureDb();

  const [totalOrgs, totalAlerts, subscriptions] = await Promise.all([
    Organization.countDocuments(),
    Alert.countDocuments(),
    Subscription.find({ status: 'active' }).lean(),
  ]);

  const PLAN_PRICE: Record<string, number> = { starter: 1999, growth: 4999, enterprise: 9999 };
  const mrr = (subscriptions as unknown as Array<{ plan: string }>).reduce(
    (sum, s) => sum + (PLAN_PRICE[s.plan] ?? 0),
    0,
  );

  const planCounts = (subscriptions as unknown as Array<{ plan: string }>).reduce<Record<string, number>>(
    (acc, s) => { acc[s.plan] = (acc[s.plan] ?? 0) + 1; return acc; },
    {},
  );

  const stats = [
    { label: 'Total Orgs', value: totalOrgs.toLocaleString() },
    { label: 'Total Alerts', value: totalAlerts.toLocaleString() },
    { label: 'Active Subs', value: subscriptions.length.toLocaleString() },
    { label: 'MRR', value: `₹${mrr.toLocaleString('en-IN')}` },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-text-primary mb-1">Dashboard</h1>
        <p className="text-sm text-text-secondary">Platform overview</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-bg-surface border border-border-subtle rounded-md p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-2">{s.label}</div>
            <div className="text-2xl font-semibold text-text-primary font-mono">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-md p-5">
        <h2 className="text-xs font-medium uppercase tracking-wider text-text-secondary mb-4">Plan distribution</h2>
        <div className="flex items-end gap-6">
          {['trial', 'starter', 'growth', 'enterprise'].map(plan => (
            <div key={plan} className="flex flex-col items-center gap-1">
              <span className="text-sm font-semibold text-text-primary font-mono">{planCounts[plan] ?? 0}</span>
              <span className="text-xs text-text-muted capitalize">{plan}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

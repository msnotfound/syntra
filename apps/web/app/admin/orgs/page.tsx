import Link from 'next/link';
import { ensureDb } from '@/lib/db';
import { Organization } from '@syntra/db';
import type { IOrganization } from '@syntra/db';

export default async function AdminOrgsPage() {
  await ensureDb();
  const orgs = await Organization.find().sort({ created_at: -1 }).limit(100).lean() as unknown as IOrganization[];

  const STATUS_COLOR: Record<string, string> = {
    active: 'text-green-400',
    suspended: 'text-yellow-400',
    cancelled: 'text-red-400',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary mb-1">Organisations</h1>
        <p className="text-sm text-text-secondary">{orgs.length} total</p>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              {['Name', 'Slug', 'Plan', 'Status', 'Industry', 'Created'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {orgs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted text-sm">No organisations yet.</td>
              </tr>
            ) : orgs.map(org => (
              <tr key={String(org._id)} className="hover:bg-bg-surface-2 transition-colors duration-[150ms]">
                <td className="px-4 py-3 font-medium text-text-primary">{org.name}</td>
                <td className="px-4 py-3 text-text-secondary font-mono text-xs">{org.slug}</td>
                <td className="px-4 py-3">
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-bg-surface-2 text-text-secondary capitalize">{org.plan}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium capitalize ${STATUS_COLOR[org.status] ?? 'text-text-muted'}`}>{org.status}</span>
                </td>
                <td className="px-4 py-3 text-text-secondary text-xs">{(org as unknown as { industry?: string }).industry ?? '—'}</td>
                <td className="px-4 py-3 text-text-muted text-xs font-mono">
                  {new Date(org.created_at).toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

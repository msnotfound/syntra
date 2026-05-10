import { ensureDb } from '@/lib/db';
import { Event } from '@syntra/db';
import type { IEvent } from '@syntra/db';

export default async function AdminEventsPage() {
  await ensureDb();
  const events = await Event.find().sort({ created_at: -1 }).limit(50).lean() as unknown as IEvent[];

  const SEV_COLOR: Record<string, string> = {
    critical: 'text-severity-critical',
    high: 'text-severity-high',
    medium: 'text-severity-medium',
    low: 'text-severity-low',
    info: 'text-text-secondary',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary mb-1">Recent Events</h1>
        <p className="text-sm text-text-secondary">Last {events.length} ingested events</p>
      </div>

      <div className="bg-bg-surface border border-border-subtle rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              {['Title', 'Severity', 'Country', 'Location', 'Type', 'Created'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted text-sm">No events ingested yet.</td>
              </tr>
            ) : events.map(ev => (
              <tr key={String(ev._id)} className="hover:bg-bg-surface-2 transition-colors duration-[150ms]">
                <td className="px-4 py-3 text-text-primary max-w-xs truncate">{ev.title}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium uppercase ${SEV_COLOR[ev.severity] ?? 'text-text-muted'}`}>{ev.severity}</span>
                </td>
                <td className="px-4 py-3 text-text-secondary font-mono text-xs">{ev.country_code}</td>
                <td className="px-4 py-3 text-text-muted text-xs font-mono">
                  {ev.location?.lat != null ? `${ev.location.lat.toFixed(3)}, ${ev.location.lng.toFixed(3)}` : '—'}
                </td>
                <td className="px-4 py-3 text-text-muted text-xs">{ev.event_type ?? '—'}</td>
                <td className="px-4 py-3 text-text-muted text-xs font-mono">
                  {new Date(ev.created_at).toISOString().replace('T', ' ').slice(0, 16)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

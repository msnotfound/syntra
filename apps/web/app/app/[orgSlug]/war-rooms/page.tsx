import Link from 'next/link';
import { Shield, Plus } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { WarRoom, User } from '@syntra/db';
import { TimeAgo } from '@syntra/ui/components/TimeAgo';
import type { IWarRoom, IUser } from '@syntra/db';

interface PageProps { params: { orgSlug: string } }

export default async function WarRoomsPage({ params }: PageProps) {
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const rooms = await WarRoom.find({ org_id: org._id })
    .sort({ created_at: -1 })
    .limit(50)
    .lean() as unknown as IWarRoom[];

  const creatorIds = [...new Set(rooms.map(r => String(r.created_by)))];
  const creators = await User.find({ _id: { $in: creatorIds } }).lean() as unknown as IUser[];
  const creatorMap = new Map(creators.map(u => [String(u._id), u.name]));

  const openCount = rooms.filter(r => r.status === 'open').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: '#FAFAFA' }}>War Rooms</h1>
          <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
            {openCount} open · {rooms.length} total
          </p>
        </div>
        <Link
          href={`/app/${params.orgSlug}/war-rooms/new`}
          className="flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-colors active:scale-95"
          style={{
            backgroundColor: '#3B82F6',
            color: '#FAFAFA',
            borderRadius: '6px',
            transitionDuration: '150ms',
          }}
        >
          <Plus size={14} />
          New War Room
        </Link>
      </div>

      {rooms.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-md border"
          style={{ borderColor: '#1E2530', backgroundColor: '#151921' }}
        >
          <Shield size={32} style={{ color: '#475569' }} />
          <p className="mt-3 text-sm font-medium" style={{ color: '#94A3B8' }}>No war rooms yet</p>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>
            Open one from a critical alert when you need to coordinate a response.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rooms.map(room => (
            <Link
              key={String(room._id)}
              href={`/app/${params.orgSlug}/war-rooms/${String(room._id)}`}
              className="flex items-center justify-between px-4 py-3 rounded-md border transition-colors"
              style={{
                backgroundColor: '#151921',
                borderColor: '#1E2530',
                transitionDuration: '150ms',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: room.status === 'open' ? '#22C55E' : '#475569' }}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: '#FAFAFA' }}>{room.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                    by {creatorMap.get(String(room.created_by)) ?? 'Unknown'} ·{' '}
                    {room.participants.length} participant{room.participants.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                <span
                  className="text-xs px-1.5 py-0.5 rounded-sm font-mono"
                  style={{
                    backgroundColor: room.status === 'open' ? 'rgba(34,197,94,0.1)' : '#1E2530',
                    color: room.status === 'open' ? '#22C55E' : '#64748B',
                    borderRadius: '4px',
                  }}
                >
                  {room.status}
                </span>
                <TimeAgo date={new Date(room.created_at)} className="text-xs font-mono text-text-muted" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

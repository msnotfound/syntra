import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ensureDb } from '@/lib/db';
import { getOrgBySlugOrThrow } from '@/lib/org';
import { WarRoom, WarRoomMessage, User } from '@syntra/db';
import { WarRoom as WarRoomUI } from '@/components/warroom/WarRoom';
import { ActionItemsPanel } from '@/components/warroom/ActionItemsPanel';
import { MitigationDecisionPanel } from '@/components/warroom/MitigationDecisionPanel';
import { LiveExposureSidebar } from '@/components/warroom/LiveExposureSidebar';
import { getServerAuth } from '@/lib/auth';
import type { IWarRoom, IWarRoomMessage, IUser } from '@syntra/db';

interface PageProps { params: { orgSlug: string; id: string } }

export default async function WarRoomDetailPage({ params }: PageProps) {
  const session = await getServerAuth();
  await ensureDb();
  const org = await getOrgBySlugOrThrow(params.orgSlug);

  const room = await WarRoom.findOne({ _id: params.id, org_id: org._id }).lean() as unknown as IWarRoom | null;
  if (!room) notFound();

  const messages = await WarRoomMessage.find({ war_room_id: params.id })
    .sort({ created_at: 1 })
    .limit(100)
    .lean() as unknown as IWarRoomMessage[];

  const participantDocs = await User.find({ _id: { $in: room.participants } }).lean() as unknown as IUser[];

  let currentUserId = '';
  if (session) {
    const me = await User.findOne({ clerk_user_id: session.userId }).lean() as unknown as IUser | null;
    currentUserId = me ? String(me._id) : '';
  }

  const alertId = room.alert_id ? String(room.alert_id) : null;

  const participants = participantDocs.map(u => ({
    id:    String(u._id),
    name:  u.name,
    email: u.email,
  }));

  const initialMessages = messages.map(m => ({
    id:          String(m._id),
    war_room_id: String(m.war_room_id),
    user_id:     String(m.user_id),
    body:        m.body,
    attachments: m.attachments,
    msg_type:    (m as unknown as { msg_type?: string }).msg_type ?? 'chat',
    poll:        (m as unknown as { poll?: unknown }).poll ?? null,
    created_at:  m.created_at,
  }));

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1.5 text-sm" style={{ color: '#64748B' }}>
        <Link
          href={`/app/${params.orgSlug}/war-rooms`}
          className="transition-colors"
          style={{ color: '#94A3B8', transitionDuration: '150ms' }}
        >
          War Rooms
        </Link>
        <ChevronRight size={14} />
        <span className="truncate max-w-sm" style={{ color: '#94A3B8' }}>{room.name}</span>
      </nav>

      <div className="flex gap-4 items-start">
        {/* Main chat column */}
        <div className="flex-1 min-w-0 rounded-md border overflow-hidden" style={{ borderColor: '#1E2530' }}>
          <WarRoomUI
            roomId={params.id}
            roomName={room.name}
            status={room.status}
            orgSlug={params.orgSlug}
            alertId={alertId}
            initialMessages={initialMessages}
            participants={participants}
            currentUserId={currentUserId}
          />
        </div>

        {/* Right sidebar */}
        <div className="w-72 flex-shrink-0 space-y-3">
          <LiveExposureSidebar roomId={params.id} alertId={alertId} />
          <ActionItemsPanel roomId={params.id} status={room.status} participants={participants} />
          <MitigationDecisionPanel alertId={alertId} />
        </div>
      </div>
    </div>
  );
}

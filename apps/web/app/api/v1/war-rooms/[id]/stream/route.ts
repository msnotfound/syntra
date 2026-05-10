import { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { WarRoom, WarRoomMessage, User } from '@syntra/db';
import { ensureDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerAuth();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return new Response('User not found', { status: 404 });

  const room = await WarRoom.findOne({ _id: params.id, org_id: user.org_id }).lean();
  if (!room) return new Response('War room not found', { status: 404 });

  const encoder = new TextEncoder();
  let lastMessageAt = new Date();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Send connection event
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ war_room_id: params.id })}\n\n`));

      const poll = async () => {
        if (closed) return;

        try {
          const newMessages = await WarRoomMessage.find({
            war_room_id: params.id,
            created_at:  { $gt: lastMessageAt },
          }).sort({ created_at: 1 }).lean();

          for (const msg of newMessages) {
            const payload = JSON.stringify({
              id:          String(msg._id),
              war_room_id: String(msg.war_room_id),
              user_id:     String(msg.user_id),
              body:        msg.body,
              attachments: msg.attachments,
              msg_type:    msg.msg_type,
              poll:        msg.poll,
              created_at:  msg.created_at,
            });
            controller.enqueue(encoder.encode(`event: message\ndata: ${payload}\n\n`));
            lastMessageAt = msg.created_at;
          }
        } catch {
          // DB error — emit keepalive and retry
        }

        if (!closed) {
          setTimeout(poll, 2000);
        }
      };

      setTimeout(poll, 2000);

      // Keepalive ping every 20s
      const ping = setInterval(() => {
        if (closed) { clearInterval(ping); return; }
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(ping);
        }
      }, 20000);

      req.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(ping);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

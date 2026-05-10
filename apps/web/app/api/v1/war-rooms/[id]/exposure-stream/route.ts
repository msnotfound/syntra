import { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { WarRoom, Exposure, User } from '@syntra/db';
import { ensureDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerAuth();
  if (!session) return new Response('Unauthorized', { status: 401 });

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return new Response('User not found', { status: 404 });

  const room = await WarRoom.findOne({ _id: params.id, org_id: user.org_id }).lean();
  if (!room) return new Response('War room not found', { status: 404 });

  const encoder = new TextEncoder();
  let closed = false;
  let lastComputedAt: Date | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      if (!room.alert_id) {
        controller.enqueue(encoder.encode(': no-alert\n\n'));
        controller.close();
        return;
      }

      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ war_room_id: params.id })}\n\n`));

      const poll = async () => {
        if (closed) return;

        try {
          const query: Record<string, unknown> = { alert_id: room.alert_id, org_id: user.org_id };
          if (lastComputedAt) query.computed_at = { $gt: lastComputedAt };

          const latest = await Exposure.findOne(query).sort({ computed_at: -1 }).lean();
          if (latest) {
            lastComputedAt = latest.computed_at;
            const payload = JSON.stringify({
              var_value_usd:     latest.var_value_usd,
              var_value_inr:     latest.var_value_inr,
              exposure_delta_usd: latest.exposure_delta_usd,
              computed_at:       latest.computed_at,
            });
            controller.enqueue(encoder.encode(`event: exposure\ndata: ${payload}\n\n`));
          }
        } catch {
          // DB error — retry next tick
        }

        if (!closed) setTimeout(poll, 3000);
      };

      setTimeout(poll, 1000);

      const ping = setInterval(() => {
        if (closed) { clearInterval(ping); return; }
        try { controller.enqueue(encoder.encode(': ping\n\n')); } catch { clearInterval(ping); }
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
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

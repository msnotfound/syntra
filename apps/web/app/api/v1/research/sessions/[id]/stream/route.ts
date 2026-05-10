import { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { ResearchSession, User } from '@syntra/db';
import { ensureDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerAuth();
  if (!session) return new Response('Unauthorized', { status: 401 });

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return new Response('User not found', { status: 404 });

  const researchSession = await ResearchSession.findOne({
    _id: params.id,
    org_id: user.org_id,
  }).lean();
  if (!researchSession) return new Response('Session not found', { status: 404 });

  const encoder = new TextEncoder();
  let closed = false;
  let lastSnapshot = JSON.stringify(researchSession.plan_steps.map(s => ({ id: s.step_id, status: s.status })));

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(
        `event: connected\ndata: ${JSON.stringify({ session_id: params.id, status: researchSession.status })}\n\n`,
      ));

      const poll = async () => {
        if (closed) return;

        try {
          const current = await ResearchSession.findOne({
            _id: params.id,
            org_id: user.org_id,
          }).lean();

          if (!current) { closed = true; return; }

          const snapshot = JSON.stringify(current.plan_steps.map(s => ({ id: s.step_id, status: s.status })));
          if (snapshot !== lastSnapshot) {
            lastSnapshot = snapshot;
            controller.enqueue(encoder.encode(
              `event: update\ndata: ${JSON.stringify({
                session_id: params.id,
                status: current.status,
                plan_steps: current.plan_steps,
              })}\n\n`,
            ));
          }

          if (current.status === 'finalized' || current.status === 'cancelled') {
            controller.enqueue(encoder.encode(
              `event: done\ndata: ${JSON.stringify({ status: current.status, final_report_id: current.final_report_id })}\n\n`,
            ));
            closed = true;
            controller.close();
            return;
          }

          // Keepalive
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          if (!closed) setTimeout(poll, 3000);
          return;
        }

        if (!closed) setTimeout(poll, 2000);
      };

      setTimeout(poll, 1000);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

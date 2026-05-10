import { NextRequest } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { ensureDb } from '@/lib/db';
import { buildWarRoomTranscriptData } from '@/lib/warroom/transcript';
import { User } from '@syntra/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerAuth();
  if (!session) return new Response('Unauthorized', { status: 401 });

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return new Response('User not found', { status: 404 });

  const data = await buildWarRoomTranscriptData(params.id, user.org_id);

  const {
    Document, Page, Text, View, StyleSheet, renderToBuffer,
  } = await import('@react-pdf/renderer');
  const { createElement: h } = await import('react');

  const styles = StyleSheet.create({
    page: { fontFamily: 'Helvetica', fontSize: 10, padding: 36, backgroundColor: 'white', color: 'black' },
    header: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: 'gray', paddingBottom: 12 },
    eyebrow: { fontSize: 8, color: 'gray', textTransform: 'uppercase', letterSpacing: 1 },
    title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginTop: 4, marginBottom: 4 },
    meta: { fontSize: 8, color: 'gray' },
    section: { marginBottom: 16 },
    sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 6 },
    row: { borderWidth: 1, borderColor: 'lightgray', padding: 8, marginBottom: 6 },
    rowMeta: { fontSize: 7, color: 'gray', marginBottom: 3 },
    body: { fontSize: 10, lineHeight: 1.45 },
    empty: { fontSize: 9, color: 'gray' },
  });

  const messageRows = data.messages.map((msg) =>
    h(View, { key: String(msg._id), style: styles.row },
      h(Text, { style: styles.rowMeta }, `${msg.msg_type ?? 'chat'} · ${new Date(msg.created_at).toLocaleString('en-IN')}`),
      h(Text, { style: styles.body }, msg.body),
    ),
  );

  const decisionRows = data.decisions.map((decision) =>
    h(View, { key: String(decision._id), style: styles.row },
      h(Text, { style: styles.rowMeta }, `${decision.decision_type} · ${new Date(decision.made_at).toLocaleString('en-IN')}`),
      h(Text, { style: styles.body }, decision.decision_text),
    ),
  );

  const actionRows = data.actionItems.map((item) =>
    h(View, { key: String(item._id), style: styles.row },
      h(Text, { style: styles.rowMeta }, `${item.status}${item.due_at ? ` · due ${new Date(item.due_at).toLocaleDateString('en-IN')}` : ''}`),
      h(Text, { style: styles.body }, item.title),
    ),
  );

  const exposureRows = data.exposures.map((exposure) =>
    h(View, { key: String(exposure._id), style: styles.row },
      h(Text, { style: styles.rowMeta }, new Date(exposure.computed_at).toLocaleString('en-IN')),
      h(Text, { style: styles.body }, `VaR USD ${exposure.var_value_usd.toLocaleString('en-IN')} · INR ${exposure.var_value_inr.toLocaleString('en-IN')}`),
    ),
  );

  const doc = h(Document, null,
    h(Page, { size: 'A4', style: styles.page },
      h(View, { style: styles.header },
        h(Text, { style: styles.eyebrow }, 'Syntra War Room Transcript'),
        h(Text, { style: styles.title }, data.room.name),
        h(Text, { style: styles.meta }, `Status ${data.room.status} · Generated ${data.generatedAt.toLocaleString('en-IN')}`),
        data.alert ? h(Text, { style: styles.meta }, `Alert: ${data.alert.event_snapshot.title}`) : null,
      ),
      h(View, { style: styles.section },
        h(Text, { style: styles.sectionTitle }, 'Messages'),
        messageRows.length > 0 ? messageRows : h(Text, { style: styles.empty }, 'No messages recorded.'),
      ),
      h(View, { style: styles.section },
        h(Text, { style: styles.sectionTitle }, 'Decisions'),
        decisionRows.length > 0 ? decisionRows : h(Text, { style: styles.empty }, 'No decisions recorded.'),
      ),
      h(View, { style: styles.section },
        h(Text, { style: styles.sectionTitle }, 'Action Items'),
        actionRows.length > 0 ? actionRows : h(Text, { style: styles.empty }, 'No action items recorded.'),
      ),
      h(View, { style: styles.section },
        h(Text, { style: styles.sectionTitle }, 'Exposure'),
        exposureRows.length > 0 ? exposureRows : h(Text, { style: styles.empty }, 'No exposure snapshots recorded.'),
      ),
    ),
  );

  const buffer = Buffer.from(await renderToBuffer(doc));

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="war-room-${params.id}-transcript.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

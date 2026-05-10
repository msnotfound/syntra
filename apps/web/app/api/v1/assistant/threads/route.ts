import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { User, AssistantThread, IntelClaim } from '@syntra/db';
import { ensureDb } from '@/lib/db';
import type { IIntelClaim } from '@syntra/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerAuth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureDb();

  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const conversationId = req.nextUrl.searchParams.get('conversation_id');
  if (!conversationId) {
    return NextResponse.json({ error: 'Missing conversation_id query param' }, { status: 400 });
  }

  const thread = await AssistantThread.findOne({
    org_id: user.org_id,
    conversation_id: conversationId,
  }).lean();

  if (!thread) return NextResponse.json({ data: null });

  // Pre-fetch all IntelClaims cited across turns so the client can render Provenance
  const allClaimIds = [...new Set(thread.turns.flatMap(t => t.cited_claim_ids))];
  const claims: IIntelClaim[] = allClaimIds.length > 0
    ? (await IntelClaim.find({ _id: { $in: allClaimIds } }).lean()) as unknown as IIntelClaim[]
    : [];

  const claimsById = new Map(claims.map(c => [String(c._id), c]));

  const turns = thread.turns.map(t => ({
    ...t,
    claims: t.cited_claim_ids
      .map(id => {
        const c = claimsById.get(id);
        if (!c) return null;
        return {
          claim_id:        String(c._id),
          claim_text:      c.claim_text,
          claim_type:      c.claim_type as 'fact' | 'inference' | 'forecast',
          evidence_url:    c.evidence_url,
          asserted_at:     c.asserted_at,
          source:          null,
          parent_claim_ids: c.parent_claim_ids.map(String),
          depth:           0,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null),
  }));

  return NextResponse.json({ data: { ...thread, turns } });
}

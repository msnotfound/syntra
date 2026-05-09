import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { IntelClaim, SourceReliability } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

interface ProvenanceNode {
  claim_id: string;
  claim_text: string;
  claim_type: string;
  evidence_url: string | null;
  asserted_at: Date;
  source: {
    source_id: string;
    source_name: string;
    admiralty_code: string;
    reliability_pct: number;
  } | null;
  parent_claim_ids: string[];
  depth: number;
}

async function buildChain(startId: string): Promise<ProvenanceNode[]> {
  const chain: ProvenanceNode[] = [];
  const visited = new Set<string>();

  async function walk(id: string, depth: number) {
    if (visited.has(id)) return;
    visited.add(id);

    const claim = await IntelClaim.findById(id).lean();
    if (!claim) return;

    const src = await SourceReliability.findById(claim.source_id).lean();

    chain.push({
      claim_id:        String(claim._id),
      claim_text:      claim.claim_text,
      claim_type:      claim.claim_type,
      evidence_url:    claim.evidence_url,
      asserted_at:     claim.asserted_at,
      source: src
        ? {
            source_id:       src.source_id,
            source_name:     src.source_name,
            admiralty_code:  src.admiralty_code,
            reliability_pct: src.reliability_pct,
          }
        : null,
      parent_claim_ids: claim.parent_claim_ids.map(String),
      depth,
    });

    for (const parentId of claim.parent_claim_ids) {
      await walk(String(parentId), depth + 1);
    }
  }

  await walk(startId, 0);
  return chain;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  await ensureDb();

  const claim = await IntelClaim.findById(params.id).lean();
  if (!claim) {
    return NextResponse.json(apiError('NOT_FOUND', 'Intel claim not found'), { status: 404 });
  }

  const provenance_chain = await buildChain(params.id);

  return NextResponse.json(
    apiResponse({
      claim_id:         String(claim._id),
      claim_text:       claim.claim_text,
      claim_type:       claim.claim_type,
      evidence_url:     claim.evidence_url,
      asserted_at:      claim.asserted_at,
      alert_id:         claim.alert_id ? String(claim.alert_id) : null,
      provenance_chain,
    }),
  );
}

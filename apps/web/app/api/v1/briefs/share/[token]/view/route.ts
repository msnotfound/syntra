import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { ensureDb } from '@/lib/db';
import { RiskBrief } from '@syntra/db';

interface RouteContext { params: { token: string } }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  await ensureDb();

  const tokenHash = createHash('sha256').update(params.token).digest('hex');
  const brief = await RiskBrief.findOneAndUpdate(
    { share_token_hash: tokenHash, expires_at: { $gt: new Date() } },
    { $inc: { view_count: 1 } },
    { new: true },
  ).lean();

  if (!brief) {
    return new NextResponse('Brief not found or link has expired.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const { renderBriefPdf } = await import('@/lib/briefs/pdf');
  const pdfBuffer = await renderBriefPdf(brief.content);
  const filename = `syntra-risk-brief-${String(brief._id)}.pdf`;

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

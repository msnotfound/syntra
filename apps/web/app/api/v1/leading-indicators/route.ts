import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { LeadingIndicator } from '@syntra/db';
import { apiResponse } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();

  const breach = req.nextUrl.searchParams.get('threshold_breach');
  const query: Record<string, unknown> = {};
  if (breach && ['normal','elevated','critical'].includes(breach)) {
    query.threshold_breach = breach;
  }

  const indicators = await LeadingIndicator.find(query).sort({ threshold_breach: -1, name: 1 }).lean();

  return NextResponse.json(apiResponse(indicators.map(i => ({
    id:              String(i._id),
    name:            i.name,
    description:     i.description,
    source_modules:  i.source_modules,
    current_value:   i.current_value,
    baseline_value:  i.baseline_value,
    sigma:           i.sigma,
    threshold_breach: i.threshold_breach,
    trend:           i.trend,
    computed_at:     i.computed_at,
  }))));
}

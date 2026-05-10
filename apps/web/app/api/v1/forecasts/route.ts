import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { Forecast } from '@syntra/db';
import { apiResponse } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();

  const { searchParams } = req.nextUrl;
  const indicatorType = searchParams.get('indicator_type');
  const status = searchParams.get('status'); // 'active' | 'resolved'
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);

  const query: Record<string, unknown> = { org_id: auth.orgId };
  if (indicatorType) query.indicator_type = indicatorType;
  if (status === 'active')   query.actual_outcome = null;
  if (status === 'resolved') query.actual_outcome = { $ne: null };

  const forecasts = await Forecast.find(query)
    .sort({ probability_pct: -1, computed_at: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json(apiResponse(forecasts.map(f => ({
    id:                     String(f._id),
    indicator_type:         f.indicator_type,
    probability_pct:        f.probability_pct,
    time_horizon_days:      f.time_horizon_days,
    narrative:              f.narrative,
    recommended_action:     f.recommended_action,
    methodology:            f.methodology,
    computed_at:            f.computed_at,
    expires_at:             f.expires_at,
    actual_outcome:         f.actual_outcome,
    brier_score:            f.brier_score,
    supporting_claims_count: f.supporting_claims.length,
  }))));
}

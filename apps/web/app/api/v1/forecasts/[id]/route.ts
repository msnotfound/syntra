import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { Forecast, LeadingIndicator } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

interface RouteContext { params: { id: string } }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();

  const forecast = await Forecast.findOne({ _id: params.id, org_id: auth.orgId }).lean();
  if (!forecast) return NextResponse.json(apiError('NOT_FOUND', 'Forecast not found'), { status: 404 });

  const indicator = await LeadingIndicator.findById(forecast.indicator_id).lean();

  return NextResponse.json(apiResponse({
    id:               String(forecast._id),
    indicator_type:   forecast.indicator_type,
    indicator: indicator ? {
      name:             indicator.name,
      description:      indicator.description,
      current_value:    indicator.current_value,
      baseline_value:   indicator.baseline_value,
      sigma:            indicator.sigma,
      threshold_breach: indicator.threshold_breach,
      trend:            indicator.trend,
    } : null,
    probability_pct:   forecast.probability_pct,
    time_horizon_days: forecast.time_horizon_days,
    narrative:         forecast.narrative,
    recommended_action: forecast.recommended_action,
    methodology:       forecast.methodology,
    computed_at:       forecast.computed_at,
    expires_at:        forecast.expires_at,
    supporting_claims: forecast.supporting_claims.map(String),
    actual_outcome:    forecast.actual_outcome,
    brier_score:       forecast.brier_score,
  }));
}

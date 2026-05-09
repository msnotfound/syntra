import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { Exposure, WatchlistEntity } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

interface RouteContext { params: { entityId: string } }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();

  const entity = await WatchlistEntity.findOne({
    _id: params.entityId,
    org_id: auth.orgId,
  }).lean();

  if (!entity) {
    return NextResponse.json(apiError('NOT_FOUND', 'Entity not found'), { status: 404 });
  }

  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);

  const exposures = await Exposure.find({
    entity_id: params.entityId,
    org_id: auth.orgId,
  })
    .sort({ computed_at: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json(apiResponse(
    exposures.map(e => ({
      id: String(e._id),
      entity_id: String(e.entity_id),
      alert_id: e.alert_id ? String(e.alert_id) : null,
      var_value_usd: e.var_value_usd,
      var_value_inr: e.var_value_inr,
      confidence_interval: e.confidence_interval,
      methodology: e.methodology,
      computed_at: e.computed_at,
    })),
  ));
}

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { Alert } from '@syntra/db';
import { apiResponse } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
  const severity = searchParams.get('severity');
  const unacked = searchParams.get('unacknowledged') === 'true';

  const query: Record<string, unknown> = { org_id: auth.orgId };
  if (severity) query.severity = severity;
  if (unacked) query.acknowledged_at = null;

  const alerts = await Alert.find(query).sort({ created_at: -1 }).limit(limit).lean();
  return NextResponse.json(apiResponse(alerts.map(a => ({
    id: String(a._id),
    severity: a.severity,
    title: a.event_snapshot.title,
    country: a.event_snapshot.country,
    location: a.event_snapshot.location,
    match_reasons: a.match_reasons,
    affected_entity_count: a.watchlist_entity_ids.length,
    occurred_at: a.event_snapshot.occurred_at,
    created_at: a.created_at,
    acknowledged_at: a.acknowledged_at,
  }))));
}

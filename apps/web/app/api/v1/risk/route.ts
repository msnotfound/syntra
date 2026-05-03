import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { Alert } from '@syntra/db';
import { apiResponse, apiError, RiskQuerySchema, haversineKm, severityOrder } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  const parsed = RiskQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json(apiError('VALIDATION_ERROR', 'lat, lng required', parsed.error.issues), { status: 400 });
  const { lat, lng, radius } = parsed.data;
  await ensureDb();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const alerts = await Alert.find({ org_id: auth.orgId, created_at: { $gte: since } }).lean();
  const nearby = alerts.filter(a => {
    const loc = a.event_snapshot.location;
    return loc && haversineKm(lat, lng, loc.lat, loc.lng) <= radius;
  });
  const score = nearby.length === 0 ? 0 : Math.min(100, nearby.reduce((acc, a) => acc + severityOrder(a.severity) * 25, 0));
  return NextResponse.json(apiResponse({ lat, lng, radius_km: radius, risk_score: score, alert_count: nearby.length, period_days: 7 }));
}

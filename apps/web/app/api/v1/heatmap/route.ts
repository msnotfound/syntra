import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { Alert, RiskScore } from '@syntra/db';
import type { IAlert } from '@syntra/db';
import { apiResponse, apiError, computeRiskScore, computeByRegion } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import type { Severity } from '@syntra/shared';

const QuerySchema = z.object({
  period_days: z.coerce.number().min(1).max(365).default(90),
});

function dominantSeverity(alerts: IAlert[]): Severity {
  const order: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
  for (const s of order) {
    if (alerts.some(a => a.severity === s)) return s;
  }
  return 'info';
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'Invalid query params', parsed.error.issues), { status: 400 });
  }
  const { period_days } = parsed.data;

  await ensureDb();
  const since = new Date(Date.now() - period_days * 24 * 60 * 60 * 1000);
  const orgId = auth.orgId;

  const [alerts, latestScore, history] = await Promise.all([
    Alert.find({ org_id: orgId, created_at: { $gte: since } }).lean() as unknown as Promise<IAlert[]>,
    RiskScore.findOne({ org_id: orgId }).sort({ computed_at: -1 }).lean(),
    RiskScore.find({ org_id: orgId })
      .sort({ computed_at: -1 })
      .limit(30)
      .select('score computed_at')
      .lean(),
  ]);

  const now = new Date();
  const scored = alerts.map(a => ({
    severity: a.severity,
    created_at: a.created_at,
    region: a.event_snapshot.country ?? null,
    route_entity_id: null as string | null,
  }));

  const org_score = latestScore?.score ?? computeRiskScore(scored, now);
  const computed_at = latestScore?.computed_at ?? now;

  // Build cells from latest score's by_region or fall back to live computation
  const by_region: Record<string, number> = latestScore?.by_region
    ? (latestScore.by_region as Record<string, number>)
    : computeByRegion(scored, now);

  // Compute per-region alert metadata for cell enrichment
  const regionAlertMap = new Map<string, IAlert[]>();
  for (const a of alerts) {
    const key = a.event_snapshot.country ?? 'Unknown';
    if (!regionAlertMap.has(key)) regionAlertMap.set(key, []);
    regionAlertMap.get(key)!.push(a);
  }

  const cells = Object.entries(by_region).map(([region, score]) => {
    const regionAlerts = regionAlertMap.get(region) ?? [];
    // Approximate center from average of event locations in this region
    const locs = regionAlerts
      .map(a => a.event_snapshot.location)
      .filter(l => l?.lat != null && l?.lng != null);
    const lat_center = locs.length > 0
      ? locs.reduce((s, l) => s + l.lat, 0) / locs.length
      : 0;
    const lng_center = locs.length > 0
      ? locs.reduce((s, l) => s + l.lng, 0) / locs.length
      : 0;
    return {
      region,
      score,
      alert_count: regionAlerts.length,
      dominant_severity: dominantSeverity(regionAlerts),
      lat_center,
      lng_center,
    };
  }).sort((a, b) => b.score - a.score);

  return NextResponse.json(
    apiResponse({
      org_score,
      cells,
      computed_at,
    }),
    {
      headers: { 'Cache-Control': 'private, max-age=300' },
      status: 200,
    },
  );
}

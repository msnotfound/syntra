import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { getServerAuth } from '@/lib/auth';
import { ensureDb } from '@/lib/db';
import { Alert, Exposure, WatchlistEntity, User, Organization, RiskBrief } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { generateBriefNarrative, buildBriefContent } from '@/lib/briefs/generate-narrative';

const BRIEF_TTL_DAYS = 30;

const BodySchema = z.object({
  alert_id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  entity_id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
}).refine(d => d.alert_id || d.entity_id, { message: 'alert_id or entity_id is required' });

export async function POST(req: NextRequest) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'), { status: 400 });
  }

  await ensureDb();

  const requestingUser = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!requestingUser) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const org = await Organization.findById(requestingUser.org_id).lean();
  if (!org) return NextResponse.json(apiError('NOT_FOUND', 'Organization not found'), { status: 404 });

  const { alert_id, entity_id } = parsed.data;

  let alertTitle: string | null = null;
  let entityName: string | null = null;
  let alertSeverity: 'critical' | 'high' | 'medium' | 'low' = 'medium';
  let eventSummary = '';
  let recommendedActions: string[] = [];
  let affectedEntities: Array<{ name: string; type: string }> = [];
  let varExposureInr: number | null = null;
  let resolvedAlertId: string | null = alert_id ?? null;
  let resolvedEntityId: string | null = entity_id ?? null;

  if (alert_id) {
    const alert = await Alert.findOne({ _id: alert_id, org_id: requestingUser.org_id }).lean();
    if (!alert) return NextResponse.json(apiError('NOT_FOUND', 'Alert not found'), { status: 404 });

    alertTitle = alert.event_snapshot.title;
    alertSeverity = alert.severity as 'critical' | 'high' | 'medium' | 'low';
    eventSummary = alert.event_snapshot.description;
    recommendedActions = alert.llm_context.recommended_actions;

    const entities = await WatchlistEntity.find({ _id: { $in: alert.watchlist_entity_ids } })
      .select('name type')
      .lean();
    affectedEntities = entities.map(e => ({ name: e.name, type: e.type }));

    const exposures = await Exposure.find({ alert_id: alert._id, org_id: requestingUser.org_id }).lean();
    if (exposures.length > 0) {
      varExposureInr = exposures.reduce((sum, e) => sum + e.var_value_inr, 0);
    }
  } else if (entity_id) {
    const entity = await WatchlistEntity.findOne({ _id: entity_id, org_id: requestingUser.org_id }).lean();
    if (!entity) return NextResponse.json(apiError('NOT_FOUND', 'Entity not found'), { status: 404 });

    entityName = entity.name;
    alertSeverity = 'medium';
    eventSummary = `Risk assessment for ${entity.name} (${entity.type})${entity.country_code ? ` in ${entity.country_code}` : ''}.`;
    affectedEntities = [{ name: entity.name, type: entity.type }];

    const latestExposure = await Exposure.findOne({ entity_id, org_id: requestingUser.org_id })
      .sort({ computed_at: -1 })
      .lean();
    if (latestExposure) {
      varExposureInr = latestExposure.var_value_inr;
    }
  }

  const narrative = await generateBriefNarrative({
    alertTitle: alertTitle ?? entityName ?? 'Risk Assessment',
    alertSeverity,
    eventSummary,
    affectedEntities,
    financialExposureInr: varExposureInr,
    recommendedActions,
    orgName: org.name,
  });

  const content = buildBriefContent(
    narrative,
    { alertTitle: alertTitle ?? entityName ?? 'Risk Assessment', alertSeverity, eventSummary, affectedEntities, financialExposureInr: varExposureInr, recommendedActions, orgName: org.name },
    alertTitle,
    entityName,
    varExposureInr,
  );

  const shareToken = randomBytes(32).toString('hex');
  const shareTokenHash = createHash('sha256').update(shareToken).digest('hex');
  const expiresAt = new Date(Date.now() + BRIEF_TTL_DAYS * 24 * 60 * 60 * 1000);

  const brief = await RiskBrief.create({
    org_id: requestingUser.org_id,
    alert_id: resolvedAlertId ?? null,
    entity_id: resolvedEntityId ?? null,
    share_token: shareToken,
    share_token_hash: shareTokenHash,
    expires_at: expiresAt,
    created_by: requestingUser._id,
    view_count: 0,
    content,
  });

  return NextResponse.json(apiResponse({
    id: String(brief._id),
    share_token: shareToken,
    share_url: `/api/v1/briefs/${shareToken}/view`,
    expires_at: expiresAt,
    created_at: brief.created_at,
  }), { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  await ensureDb();

  const requestingUser = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!requestingUser) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);

  const briefs = await RiskBrief.find({ org_id: requestingUser.org_id })
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json(apiResponse(briefs.map(b => ({
    id: String(b._id),
    alert_id: b.alert_id ? String(b.alert_id) : null,
    entity_id: b.entity_id ? String(b.entity_id) : null,
    alert_title: b.content.alert_title,
    entity_name: b.content.entity_name,
    severity: b.content.severity,
    share_token: b.share_token,
    expires_at: b.expires_at,
    view_count: b.view_count,
    created_at: b.created_at,
  }))));
}

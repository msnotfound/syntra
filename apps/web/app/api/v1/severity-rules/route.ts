import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SeverityRule, WatchlistEntity } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

const CreateSchema = z.object({
  entity_id: z.string().length(24),
  condition_type: z.enum(['event_kind', 'event_kind+geo', 'always']),
  event_kind: z.string().nullable().optional(),
  geo_country_code: z.string().length(2).toUpperCase().nullable().optional(),
  threshold: z.enum(['low', 'medium', 'high', 'critical']),
  notification_channels: z.array(z.enum(['email', 'whatsapp', 'webhook'])).default([]),
});

export async function GET(_req: NextRequest) {
  const session = await requireAuth().catch(() => null);
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });
  await ensureDb();

  const rules = await SeverityRule.find({ org_id: session.orgId, active: true })
    .sort({ created_at: -1 })
    .lean();

  // Resolve entity names for display
  const entityIds = [...new Set(rules.map(r => String(r.entity_id)))];
  const entities = await WatchlistEntity.find({ _id: { $in: entityIds } }).lean();
  const entityMap = Object.fromEntries(entities.map(e => [String(e._id), { name: e.name, type: e.type }]));

  // Also return available entities for the create form
  const allEntities = await WatchlistEntity.find({ org_id: session.orgId, active: true })
    .select('_id name type')
    .lean();

  return NextResponse.json(apiResponse({
    rules: rules.map(r => ({
      id: String(r._id),
      entity_id: String(r.entity_id),
      entity_name: entityMap[String(r.entity_id)]?.name ?? null,
      entity_type: entityMap[String(r.entity_id)]?.type ?? null,
      condition_type: r.condition_type,
      event_kind: r.event_kind,
      geo_country_code: r.geo_country_code,
      threshold: r.threshold,
      notification_channels: r.notification_channels,
      created_at: r.created_at,
    })),
    entities: allEntities.map(e => ({
      id: String(e._id),
      name: e.name,
      type: e.type,
    })),
  }));
}

export async function POST(req: NextRequest) {
  const session = await requireAuth().catch(() => null);
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });
  await ensureDb();

  const body = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
      { status: 400 },
    );
  }

  const { condition_type, event_kind, geo_country_code } = parsed.data;
  if (condition_type !== 'always' && !event_kind) {
    return NextResponse.json(
      apiError('VALIDATION_ERROR', 'event_kind required for this condition_type'),
      { status: 400 },
    );
  }
  if (condition_type === 'event_kind+geo' && !geo_country_code) {
    return NextResponse.json(
      apiError('VALIDATION_ERROR', 'geo_country_code required for event_kind+geo'),
      { status: 400 },
    );
  }

  const rule = await SeverityRule.create({
    org_id: session.orgId,
    entity_id: parsed.data.entity_id,
    condition_type,
    event_kind: event_kind ?? null,
    geo_country_code: geo_country_code ?? null,
    threshold: parsed.data.threshold,
    notification_channels: parsed.data.notification_channels,
    active: true,
  });

  return NextResponse.json(
    apiResponse({ id: String(rule._id), ...parsed.data }),
    { status: 201 },
  );
}

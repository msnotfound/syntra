import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SeverityRule } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

const PatchSchema = z.object({
  condition_type: z.enum(['event_kind', 'event_kind+geo', 'always']).optional(),
  event_kind: z.string().nullable().optional(),
  geo_country_code: z.string().length(2).toUpperCase().nullable().optional(),
  threshold: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  notification_channels: z.array(z.enum(['email', 'whatsapp', 'webhook'])).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth().catch(() => null);
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });
  await ensureDb();

  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
      { status: 400 },
    );
  }

  const rule = await SeverityRule.findOneAndUpdate(
    { _id: params.id, org_id: session.orgId, active: true },
    { $set: parsed.data },
    { new: true },
  ).lean();

  if (!rule) return NextResponse.json(apiError('NOT_FOUND', 'Rule not found'), { status: 404 });

  return NextResponse.json(apiResponse({
    id: String(rule._id),
    entity_id: String(rule.entity_id),
    condition_type: rule.condition_type,
    event_kind: rule.event_kind,
    geo_country_code: rule.geo_country_code,
    threshold: rule.threshold,
    notification_channels: rule.notification_channels,
  }));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth().catch(() => null);
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });
  await ensureDb();

  const rule = await SeverityRule.findOneAndUpdate(
    { _id: params.id, org_id: session.orgId },
    { $set: { active: false } },
    { new: true },
  ).lean();

  if (!rule) return NextResponse.json(apiError('NOT_FOUND', 'Rule not found'), { status: 404 });

  return NextResponse.json(apiResponse({ id: String(rule._id), deleted: true }));
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { Alert, MitigationSuggestion, User } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { z } from 'zod';

const CreateSchema = z.object({
  suggestion_type: z.enum(['alt_route', 'alt_supplier', 'inventory_buffer', 'contract_clause']),
  narrative: z.string().min(1).max(2000),
  confidence_pct: z.number().min(0).max(100),
  estimated_var_reduction_usd: z.number().nullable().default(null),
  sources: z.array(z.string()).default([]),
});

interface RouteContext { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const alert = await Alert.findOne({ _id: params.id, org_id: user.org_id }).lean();
  if (!alert) return NextResponse.json(apiError('NOT_FOUND', 'Alert not found'), { status: 404 });

  const suggestions = await MitigationSuggestion.find({ alert_id: alert._id, org_id: user.org_id })
    .sort({ created_at: -1 })
    .lean();

  return NextResponse.json(apiResponse(suggestions.map(s => ({
    id:                          String(s._id),
    alert_id:                    String(s.alert_id),
    suggestion_type:             s.suggestion_type,
    narrative:                   s.narrative,
    confidence_pct:              s.confidence_pct,
    estimated_var_reduction_usd: s.estimated_var_reduction_usd,
    sources:                     s.sources,
    status:                      s.status,
    created_at:                  s.created_at,
  }))));
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'), { status: 400 });
  }

  await ensureDb();
  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const alert = await Alert.findOne({ _id: params.id, org_id: user.org_id }).lean();
  if (!alert) return NextResponse.json(apiError('NOT_FOUND', 'Alert not found'), { status: 404 });

  const suggestion = await MitigationSuggestion.create({
    org_id:                      user.org_id,
    alert_id:                    alert._id,
    suggestion_type:             parsed.data.suggestion_type,
    narrative:                   parsed.data.narrative,
    confidence_pct:              parsed.data.confidence_pct,
    estimated_var_reduction_usd: parsed.data.estimated_var_reduction_usd,
    sources:                     parsed.data.sources,
    status:                      'proposed',
  });

  return NextResponse.json(apiResponse({
    id:                          String(suggestion._id),
    alert_id:                    String(suggestion.alert_id),
    suggestion_type:             suggestion.suggestion_type,
    narrative:                   suggestion.narrative,
    confidence_pct:              suggestion.confidence_pct,
    estimated_var_reduction_usd: suggestion.estimated_var_reduction_usd,
    sources:                     suggestion.sources,
    status:                      suggestion.status,
    created_at:                  suggestion.created_at,
  }), { status: 201 });
}

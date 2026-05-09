import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { ensureDb } from '@/lib/db';
import { User, RiskBrief } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';

interface RouteContext { params: { id: string } }

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  await ensureDb();

  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const brief = await RiskBrief.findOne({ _id: params.id, org_id: user.org_id }).lean();
  if (!brief) return NextResponse.json(apiError('NOT_FOUND', 'Brief not found'), { status: 404 });

  return NextResponse.json(apiResponse({
    id: String(brief._id),
    org_id: String(brief.org_id),
    alert_id: brief.alert_id ? String(brief.alert_id) : null,
    entity_id: brief.entity_id ? String(brief.entity_id) : null,
    expires_at: brief.expires_at,
    view_count: brief.view_count,
    content: brief.content,
    created_at: brief.created_at,
  }));
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  await ensureDb();

  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const deleted = await RiskBrief.findOneAndDelete({ _id: params.id, org_id: user.org_id });
  if (!deleted) return NextResponse.json(apiError('NOT_FOUND', 'Brief not found'), { status: 404 });

  return NextResponse.json(apiResponse({ deleted: true }));
}

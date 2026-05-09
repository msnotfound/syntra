import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { Decision, User, Alert } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';
import { z } from 'zod';
import mongoose from 'mongoose';

const ObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const PostBodySchema = z.object({
  alert_id: ObjectIdSchema,
  decision_type: z.enum(['acknowledged', 'assigned', 'closed', 'escalated', 'mitigation_chosen']),
  decision_text: z.string().min(1, 'decision_text is required'),
  justification: z.string().default(''),
});

export async function GET(req: NextRequest) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  await ensureDb();

  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { org_id: user.org_id };

  const userIdParam = searchParams.get('user_id');
  if (userIdParam && /^[a-f\d]{24}$/i.test(userIdParam)) {
    filter.user_id = new mongoose.Types.ObjectId(userIdParam);
  }

  const alertIdParam = searchParams.get('alert_id');
  if (alertIdParam && /^[a-f\d]{24}$/i.test(alertIdParam)) {
    filter.alert_id = new mongoose.Types.ObjectId(alertIdParam);
  }

  const typeParam = searchParams.get('type');
  if (typeParam) filter.decision_type = typeParam;

  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  if (fromParam || toParam) {
    const dateFilter: Record<string, Date> = {};
    if (fromParam) dateFilter.$gte = new Date(fromParam);
    if (toParam) dateFilter.$lte = new Date(toParam);
    filter.made_at = dateFilter;
  }

  const [decisions, total] = await Promise.all([
    Decision.find(filter).sort({ made_at: -1 }).skip(skip).limit(limit).lean(),
    Decision.countDocuments(filter),
  ]);

  return NextResponse.json(apiResponse({
    decisions: decisions.map(d => ({
      id: String(d._id),
      alert_id: String(d.alert_id),
      user_id: String(d.user_id),
      decision_type: d.decision_type,
      decision_text: d.decision_text,
      justification: d.justification,
      made_at: d.made_at,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }));
}

export async function POST(req: NextRequest) {
  const session = await getServerAuth();
  if (!session) return NextResponse.json(apiError('UNAUTHORIZED', 'Not authenticated'), { status: 401 });

  const parsed = PostBodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(apiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'), { status: 400 });
  }

  await ensureDb();

  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return NextResponse.json(apiError('NOT_FOUND', 'User not found'), { status: 404 });

  const alert = await Alert.findOne({ _id: parsed.data.alert_id, org_id: user.org_id }).lean();
  if (!alert) return NextResponse.json(apiError('NOT_FOUND', 'Alert not found'), { status: 404 });

  const decision = await Decision.create({
    org_id: user.org_id,
    alert_id: new mongoose.Types.ObjectId(parsed.data.alert_id),
    user_id: user._id,
    decision_type: parsed.data.decision_type,
    decision_text: parsed.data.decision_text,
    justification: parsed.data.justification,
    made_at: new Date(),
  });

  return NextResponse.json(apiResponse({
    id: String(decision._id),
    alert_id: String(decision.alert_id),
    decision_type: decision.decision_type,
    made_at: decision.made_at,
  }), { status: 201 });
}

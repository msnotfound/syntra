import { NextRequest, NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/auth';
import { Decision, User } from '@syntra/db';
import { ensureDb } from '@/lib/db';
import mongoose from 'mongoose';

function escapeCSV(val: unknown): string {
  const str = val == null ? '' : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const session = await getServerAuth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  await ensureDb();

  const user = await User.findOne({ clerk_user_id: session.userId }).lean();
  if (!user) return new NextResponse('User not found', { status: 404 });

  const { searchParams } = req.nextUrl;
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

  const decisions = await Decision.find(filter).sort({ made_at: -1 }).limit(5000).lean();

  const header = ['id', 'alert_id', 'user_id', 'decision_type', 'decision_text', 'justification', 'made_at'].join(',');
  const rows = decisions.map(d =>
    [
      d._id,
      d.alert_id,
      d.user_id,
      d.decision_type,
      d.decision_text,
      d.justification,
      d.made_at.toISOString(),
    ].map(escapeCSV).join(','),
  );

  const csv = [header, ...rows].join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="decisions.csv"',
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { Alert } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  await ensureDb();
  const alert = await Alert.findOneAndUpdate(
    { _id: params.id, org_id: auth.orgId, acknowledged_at: null },
    { acknowledged_at: new Date() },
    { new: true }
  ).lean();
  if (!alert) return NextResponse.json(apiError('NOT_FOUND', 'Alert not found or already acknowledged'), { status: 404 });
  return NextResponse.json(apiResponse({ id: String(alert._id), acknowledged_at: alert.acknowledged_at }));
}

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { Event } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  await ensureDb();
  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
  const page = Math.max(parseInt(searchParams.get('page') ?? '1'), 1);
  const severity = searchParams.get('severity');
  const country = searchParams.get('country');

  const query: Record<string, unknown> = {};
  if (severity) query.severity = severity;
  if (country) query.country_code = country.toUpperCase();

  const [events, total] = await Promise.all([
    Event.find(query).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Event.countDocuments(query),
  ]);

  return NextResponse.json(apiResponse(events.map(e => ({
    id: String(e._id),
    title: e.title,
    description: e.description,
    location: e.location,
    country: e.country,
    country_code: e.country_code,
    severity: e.severity,
    event_type: e.event_type,
    sources: e.sources,
    occurred_at: e.occurred_at,
    created_at: e.created_at,
  }))
  ));
}

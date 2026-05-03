import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { ApiKey, Organization, UsageEvent } from '@syntra/db';
import { ensureDb } from '../db';
import { apiError } from '@syntra/shared';

const hasUpstash = !!(process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN);

async function getRateLimiter() {
  if (hasUpstash) {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { Redis } = await import('@upstash/redis');
    return { Ratelimit, redis: new Redis({ url: process.env.UPSTASH_REDIS_URL!, token: process.env.UPSTASH_REDIS_TOKEN! }) };
  }
  return null;
}

// In-memory rate limit fallback
const inMemoryCounters = new Map<string, { count: number; resetAt: number }>();
function inMemoryRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = inMemoryCounters.get(key);
  if (!entry || now > entry.resetAt) {
    inMemoryCounters.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export interface ApiAuthResult {
  orgId: string;
  keyId: string;
  scopes: string[];
  rateLimit: number;
}

export async function authenticateApiKey(req: NextRequest): Promise<ApiAuthResult | NextResponse> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json(apiError('UNAUTHORIZED', 'Missing Authorization header'), { status: 401 });
  }

  const key = auth.slice(7).trim();
  if (!key.startsWith('syn_live_') && !key.startsWith('syn_test_')) {
    return NextResponse.json(apiError('UNAUTHORIZED', 'Invalid API key format'), { status: 401 });
  }

  await ensureDb();
  const hash = createHash('sha256').update(key).digest('hex');
  const apiKey = await ApiKey.findOne({ key_hash: hash, revoked_at: null }).lean();
  if (!apiKey) {
    return NextResponse.json(apiError('UNAUTHORIZED', 'Invalid or revoked API key'), { status: 401 });
  }

  const org = await Organization.findById(apiKey.org_id).lean();
  if (!org || org.status === 'suspended' || org.status === 'cancelled') {
    return NextResponse.json(apiError('FORBIDDEN', 'Organization is not active'), { status: 403 });
  }

  const rateLimitKey = `ratelimit:${String(apiKey._id)}`;
  const allowed = inMemoryRateLimit(rateLimitKey, apiKey.rate_limit_per_minute);
  if (!allowed) {
    return NextResponse.json(apiError('RATE_LIMITED', 'Rate limit exceeded'), { status: 429 });
  }

  // Update last_used_at (fire-and-forget)
  ApiKey.updateOne({ _id: apiKey._id }, { last_used_at: new Date() }).catch(() => {});
  UsageEvent.create({ org_id: apiKey.org_id, type: 'api_call', metadata: { path: req.nextUrl.pathname } }).catch(() => {});

  return {
    orgId: String(apiKey.org_id),
    keyId: String(apiKey._id),
    scopes: apiKey.scopes,
    rateLimit: apiKey.rate_limit_per_minute,
  };
}

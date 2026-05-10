// Per-user turn rate limit: 60 per hour (in-memory; resets on server restart)
const userTurnWindow = new Map<string, { count: number; resetAt: number }>();

export function checkUserRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = userTurnWindow.get(userId);
  if (!entry || now > entry.resetAt) {
    userTurnWindow.set(userId, { count: 1, resetAt: now + 3_600_000 });
    return true;
  }
  if (entry.count >= 60) return false;
  entry.count += 1;
  return true;
}

export function extractClaimIds(text: string): string[] {
  const matches = [...text.matchAll(/\[claim:([a-zA-Z0-9_-]+)\]/g)];
  return [...new Set(matches.map(m => m[1]))];
}

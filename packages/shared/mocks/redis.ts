console.warn('[MOCK] Using in-memory Redis mock — set UPSTASH_REDIS_URL + UPSTASH_REDIS_TOKEN in .env and restart to use real.');

interface Entry { value: string; expiresAt: number | null }

const store = new Map<string, Entry>();

function isExpired(entry: Entry) {
  return entry.expiresAt !== null && Date.now() > entry.expiresAt;
}

export const redisMock = {
  async get(key: string): Promise<string | null> {
    const entry = store.get(key);
    if (!entry || isExpired(entry)) { store.delete(key); return null; }
    return entry.value;
  },
  async set(key: string, value: string): Promise<void> {
    store.set(key, { value, expiresAt: null });
  },
  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  },
  async expire(key: string, ttlSeconds: number): Promise<void> {
    const entry = store.get(key);
    if (entry) entry.expiresAt = Date.now() + ttlSeconds * 1000;
  },
  async del(...keys: string[]): Promise<void> {
    for (const k of keys) store.delete(k);
  },
  async incr(key: string): Promise<number> {
    const entry = store.get(key);
    const val = entry ? parseInt(entry.value, 10) + 1 : 1;
    store.set(key, { value: String(val), expiresAt: entry?.expiresAt ?? null });
    return val;
  },
  async exists(key: string): Promise<number> {
    const entry = store.get(key);
    return entry && !isExpired(entry) ? 1 : 0;
  },
};

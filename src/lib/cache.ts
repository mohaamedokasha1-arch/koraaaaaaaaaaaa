/**
 * Tiered in-memory TTL cache.
 *
 * - getOrSet(): standard cache-aside with stale-while-returning for fallback:
 *   every entry keeps its payload past expiry so provider outages degrade to
 *   "stale" data instead of empty screens (never fabricated data — only real
 *   provider responses, clearly marked stale).
 * - Works on Vercel serverless (per-instance) and in dev. For multi-region
 *   deployments an external store (Redis/Vercel KV) can replace this module
 *   without touching callers.
 */

export const CACHE_TTL = {
  LIVE_MATCHES: 25,
  MATCH_DETAIL: 60,
  TODAY_FIXTURES: 300,
  RESULTS: 600,
  UPCOMING: 900,
  LEAGUE_MATCHES: 900,
  STANDINGS: 3600,
  TOP_SCORERS: 3600,
  LEAGUES: 86400,
  TEAM_INFO: 86400,
  TEAM_SQUAD: 86400,
  SEARCH: 1800,
  /** openfootball historical seasons — immutable public-domain datasets */
  HISTORY: 86400,
  /** RSS news headlines */
  NEWS: 600,
} as const;

interface Entry<T> {
  value: T;
  fetchedAt: string; // time the upstream value was last refreshed (not last read)
  expiresAt: number; // fresh window
  hardExpiresAt: number; // absolute drop time (stale window ends)
}

export interface CacheHit<T> {
  value: T;
  stale: boolean;
  fetchedAt: string;
}

/** Stale payloads are kept for this long after expiry, to survive outages. */
const STALE_GRACE_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_ENTRIES = 2000;

class MemoryCache {
  private store = new Map<string, Entry<unknown>>();

  get<T>(key: string): CacheHit<T> | null {
    const entry = this.store.get(key) as Entry<T> | undefined;
    if (!entry) return null;
    const now = Date.now();
    if (now < entry.expiresAt) {
      return { value: entry.value, stale: false, fetchedAt: entry.fetchedAt };
    }
    if (now < entry.hardExpiresAt) {
      return { value: entry.value, stale: true, fetchedAt: entry.fetchedAt };
    }
    this.store.delete(key);
    return null;
  }

  getStale<T>(key: string): Pick<CacheHit<T>, 'value' | 'fetchedAt'> | null {
    const entry = this.store.get(key) as Entry<T> | undefined;
    if (!entry) return null;
    const now = Date.now();
    if (now < entry.hardExpiresAt) {
      return { value: entry.value, fetchedAt: entry.fetchedAt };
    }
    this.store.delete(key);
    return null;
  }

  set<T>(key: string, value: T, ttlSeconds: number): string {
    if (this.store.size >= MAX_ENTRIES) this.evict();
    const now = Date.now();
    const fetchedAt = new Date(now).toISOString();
    this.store.set(key, {
      value,
      fetchedAt,
      expiresAt: now + ttlSeconds * 1000,
      hardExpiresAt: now + ttlSeconds * 1000 + STALE_GRACE_MS,
    });
    return fetchedAt;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  private evict(): void {
    // drop expired first, then oldest (Map preserves insertion order)
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (now >= v.hardExpiresAt) this.store.delete(k);
    }
    let n = Math.max(0, this.store.size - MAX_ENTRIES + 100);
    for (const k of this.store.keys()) {
      if (n-- <= 0) break;
      this.store.delete(k);
    }
  }

  stats() {
    return { entries: this.store.size, maxEntries: MAX_ENTRIES };
  }
}

// keep a single instance across Next.js dev-server hot reloads
const globalForCache = globalThis as unknown as { __koraCache?: MemoryCache };
export const cache = globalForCache.__koraCache ?? (globalForCache.__koraCache = new MemoryCache());

/**
 * Cache-aside helper: returns fresh cached value, otherwise runs the loader,
 * stores its result and returns it. Fail-soft is handled by callers using
 * getStale so they can decide how to degrade.
 */
export async function getOrSet<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<{ value: T; stale: boolean }> {
  const hit = cache.get<T>(key);
  if (hit && !hit.stale) return hit;
  const value = await loader();
  cache.set(key, value, ttlSeconds);
  return { value, stale: false };
}

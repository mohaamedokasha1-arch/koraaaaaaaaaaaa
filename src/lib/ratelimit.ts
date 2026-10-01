import 'server-only';

/**
 * Lightweight abuse protection for the site's own JSON endpoints.
 *
 * Deliberately conservative and per-instance: it exists to stop a single client
 * (or a runaway script) from hammering `/api/*` and, through it, burning the
 * upstream providers' quota. Normal users — and crawlers hitting pages, which
 * are served from the shared cache — never hit these limits.
 *
 * `Googlebot` and other declared crawlers are exempt by default (new private
 * reads opt out with allowCrawlerBypass: false): the JSON API is not part
 * of the crawlable page experience and the pages never depend on a client-side
 * call to render their main content, but exempting them avoids any chance of a
 * false 429 during rendering.
 */

interface Bucket {
  hits: number;
  resetAt: number;
}

const globalForLimits = globalThis as unknown as { __koraLimits?: Map<string, Bucket> };
const buckets = globalForLimits.__koraLimits ?? (globalForLimits.__koraLimits = new Map());

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_BUCKETS = 5000;
let lastCleanup = Date.now();

function cleanup(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
  if (buckets.size > MAX_BUCKETS) {
    const overflow = buckets.size - MAX_BUCKETS;
    let i = 0;
    for (const key of buckets.keys()) {
      if (i++ >= overflow) break;
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/** Ephemeral limiter key in this instance only; no application logging or DB. */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
  return `${scope}:${ip}`;
}

export function isCrawler(request: Request): boolean {
  const ua = request.headers.get('user-agent') ?? '';
  return /googlebot|bingbot|duckduckbot|yandexbot|applebot|slurp|baiduspider/i.test(ua);
}

export function rateLimit(
  request: Request,
  scope: string,
  { limit, windowSeconds, allowCrawlerBypass = true }: { limit: number; windowSeconds: number; allowCrawlerBypass?: boolean },
): RateLimitResult {
  const now = Date.now();
  cleanup(now);

  if (allowCrawlerBypass && isCrawler(request)) {
    return { ok: true, remaining: limit, retryAfterSeconds: 0 };
  }

  const key = clientKey(request, scope);
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { hits: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.hits += 1;
  if (bucket.hits > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { ok: true, remaining: Math.max(0, limit - bucket.hits), retryAfterSeconds: 0 };
}

/** Convenience wrapper returning a ready-to-send 429 when the limit is hit. */
export function tooManyRequests(result: RateLimitResult): Response {
  return new Response(JSON.stringify({ error: 'too many requests' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Retry-After': String(result.retryAfterSeconds),
      'Cache-Control': 'no-store',
    },
  });
}

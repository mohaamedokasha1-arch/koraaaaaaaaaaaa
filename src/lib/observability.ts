import 'server-only';
import { getHealth } from '@/lib/circuit';
import { cache } from '@/lib/cache';
import { matchStoreStats, recentConflicts, stuckLiveMatches } from '@/lib/matchStore';
import { ambiguityReview, entityConflicts, registryStats } from '@/lib/entities';
import { catalogSummary } from '@/lib/providers/catalog';
import { newsEnabled, newsSourceHealth } from '@/lib/news';
import { SITE_URL, siteUrlProblem } from '@/lib/seo';
import { log } from '@/lib/log';

/**
 * Internal observability.
 *
 * Goal: know about a problem BEFORE a user does — a dead source, a source that
 * suddenly answers with empty payloads, a rate limit about to be hit, a slow
 * upstream, a live match frozen for half an hour, news that stopped arriving,
 * or a spike of unlinked/ambiguous entities.
 *
 * Everything here is free and Vercel-native: counters in the instance, checks
 * evaluated on demand, structured logs, and one protected diagnostics endpoint.
 * No paid monitoring service is assumed, and no secret is ever returned.
 */

export interface Observation {
  id: string;
  level: 'ok' | 'warn' | 'critical';
  title: string;
  detail: string;
  value?: number | string | null;
  at: string;
}

interface SourceMetrics {
  calls: number;
  failures: number;
  emptyResponses: number;
  consecutiveEmpty: number;
  lastItems: number | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastLatencyMs: number | null;
  maxLatencyMs: number;
  totalLatencyMs: number;
  callTimestamps: number[];
}

const MAX_TIMESTAMPS = 120;

/** Declared upstream budgets (requests per minute) used for proximity checks. */
const RATE_BUDGETS: Record<string, number> = {
  'api.football-data.org': 8, // free plan is 10/min; the adapter self-caps at 8
  'v3.football.api-sports.io': 10,
  'www.thesportsdb.com': 30,
  'site.api.espn.com': 60,
  'raw.githubusercontent.com': 60,
};

const globalForMetrics = globalThis as unknown as { __koraMetrics?: Map<string, SourceMetrics> };
const metrics = globalForMetrics.__koraMetrics ?? (globalForMetrics.__koraMetrics = new Map());

function bucket(host: string): SourceMetrics {
  let entry = metrics.get(host);
  if (!entry) {
    entry = {
      calls: 0,
      failures: 0,
      emptyResponses: 0,
      consecutiveEmpty: 0,
      lastItems: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastLatencyMs: null,
      maxLatencyMs: 0,
      totalLatencyMs: 0,
      callTimestamps: [],
    };
    metrics.set(host, entry);
  }
  return entry;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

/** Called by the HTTP layer for every upstream request. */
export function trackUpstreamCall(url: string, latencyMs: number, ok: boolean): void {
  const host = hostOf(url);
  const entry = bucket(host);
  entry.calls += 1;
  if (!ok) entry.failures += 1;
  entry.lastLatencyMs = latencyMs;
  entry.totalLatencyMs += latencyMs;
  if (latencyMs > entry.maxLatencyMs) entry.maxLatencyMs = latencyMs;
  const now = Date.now();
  entry.callTimestamps.push(now);
  if (entry.callTimestamps.length > MAX_TIMESTAMPS) entry.callTimestamps.shift();
  if (ok) entry.lastSuccessAt = new Date(now).toISOString();
  else entry.lastFailureAt = new Date(now).toISOString();
}

/** Called by services that know how many real records a source returned. */
export function trackSourcePayload(source: string, items: number, ok = true): void {
  const entry = bucket(source);
  if (!ok) {
    entry.failures += 1;
    entry.lastFailureAt = new Date().toISOString();
    return;
  }
  entry.lastSuccessAt = new Date().toISOString();
  entry.lastItems = items;
  if (items === 0) {
    entry.emptyResponses += 1;
    entry.consecutiveEmpty += 1;
  } else {
    entry.consecutiveEmpty = 0;
  }
}

export function sourceMetricsSnapshot(): Record<string, SourceMetrics> {
  return Object.fromEntries([...metrics.entries()].map(([host, value]) => [host, { ...value }]));
}

function callsLastMinute(host: string): number {
  const entry = metrics.get(host);
  if (!entry) return 0;
  const cutoff = Date.now() - 60_000;
  return entry.callTimestamps.filter((timestamp: number) => timestamp >= cutoff).length;
}

/**
 * Evaluate every check. Pure read of runtime state — safe to call from the
 * diagnostics endpoint and from /api/health.
 */
export function runChecks(now = Date.now()): Observation[] {
  const at = new Date(now).toISOString();
  const checks: Observation[] = [];

  // 1. Provider outages (circuit breaker state).
  const health = getHealth().filter((h) => !h.providerId.startsWith('news:'));
  const open = health.filter((h) => h.state === 'open');
  checks.push({
    id: 'sources.open_circuits',
    level: open.length === 0 ? 'ok' : open.length >= 2 ? 'critical' : 'warn',
    title: 'Sources with an open circuit',
    detail: open.length === 0
      ? 'Every configured source is answering.'
      : open.map((h) => `${h.providerId} (${h.lastError ?? 'error'})`).join(', '),
    value: open.length,
    at,
  });

  // 2. A source that suddenly answers with empty payloads.
  const emptySources = [...metrics.entries()].filter(
    ([, value]) => value.consecutiveEmpty >= 3 && value.lastItems === 0,
  );
  checks.push({
    id: 'sources.empty_payloads',
    level: emptySources.length === 0 ? 'ok' : 'warn',
    title: 'Sources returning empty payloads repeatedly',
    detail: emptySources.length === 0
      ? 'No source is stuck returning empty results.'
      : emptySources.map(([host, value]) => `${host} (${value.consecutiveEmpty} in a row)`).join(', '),
    value: emptySources.length,
    at,
  });

  // 3. Rate-limit proximity.
  const nearLimit = Object.entries(RATE_BUDGETS)
    .map(([host, budget]) => ({ host, budget, used: callsLastMinute(host) }))
    .filter((row) => row.used >= Math.ceil(row.budget * 0.8));
  checks.push({
    id: 'sources.rate_limit_proximity',
    level: nearLimit.length === 0 ? 'ok' : 'warn',
    title: 'Upstream rate-limit proximity',
    detail: nearLimit.length === 0
      ? 'All sources are comfortably inside their per-minute budget.'
      : nearLimit.map((row) => `${row.host}: ${row.used}/${row.budget} per minute`).join(', '),
    value: nearLimit.length,
    at,
  });

  // 4. Slow upstreams.
  const slow = [...metrics.entries()].filter(([, value]) => (value.lastLatencyMs ?? 0) > 6000);
  checks.push({
    id: 'sources.slow',
    level: slow.length === 0 ? 'ok' : 'warn',
    title: 'Slow upstream calls',
    detail: slow.length === 0
      ? 'No upstream call exceeded 6s on the last attempt.'
      : slow.map(([host, value]) => `${host}: ${value.lastLatencyMs}ms`).join(', '),
    value: slow.length,
    at,
  });

  // 5. News freshness (a live feed that stopped delivering).
  if (newsEnabled()) {
    const sources = newsSourceHealth();
    const silent = sources.filter((source) => {
      if (!source.lastSuccessAt) return source.consecutiveFailures > 0;
      return now - Date.parse(source.lastSuccessAt) > 6 * 3600 * 1000;
    });
    checks.push({
      id: 'news.silent_sources',
      level: silent.length === 0 ? 'ok' : 'warn',
      title: 'News sources that went quiet',
      detail: silent.length === 0
        ? 'Every enabled news source delivered recently.'
        : silent.map((s) => `${s.name} (${s.lastSuccessAt ?? 'never'})`).join(', '),
      value: silent.length,
      at,
    });
  } else {
    checks.push({
      id: 'news.disabled',
      level: 'ok',
      title: 'News aggregation is switched off',
      detail: 'No news source is configured (NEWS_PRESETS / NEWS_FEEDS are empty) — nothing is fetched.',
      value: 0,
      at,
    });
  }

  // 6. Live matches frozen in a live state.
  const stuck = stuckLiveMatches(now);
  checks.push({
    id: 'matches.stuck_live',
    level: stuck.length === 0 ? 'ok' : stuck.length > 3 ? 'critical' : 'warn',
    title: 'Live matches without updates',
    detail: stuck.length === 0
      ? 'No live match has been stale for more than 25 minutes.'
      : `${stuck.length} live match(es) stale: ${stuck.slice(0, 5).join(', ')}`,
    value: stuck.length,
    at,
  });

  // 7. Entity linking quality.
  const registry = registryStats();
  const review = ambiguityReview(50);
  checks.push({
    id: 'entities.ambiguity',
    level: review.length === 0 ? 'ok' : review.length > 20 ? 'warn' : 'ok',
    title: 'Entity ambiguity queue',
    detail: review.length === 0
      ? 'No same-name entities were refused a merge.'
      : `${review.length} name clash(es) kept separate for review: ${review.slice(0, 3).map((r) => r.key).join(', ')}`,
    value: review.length,
    at,
  });
  checks.push({
    id: 'entities.coverage',
    level: registry.entities > 0 ? 'ok' : 'warn',
    title: 'Entity registry size',
    detail: `${registry.entities} entities, ${registry.refs} provider refs.`,
    value: registry.entities,
    at,
  });

  // 8. Conflict log (stale writes blocked, illegal transitions refused).
  const conflicts = recentConflicts(50);
  const blocked = conflicts.filter((c) => c.code === 'stale_write_blocked').length;
  checks.push({
    id: 'data.conflicts',
    level: blocked === 0 ? 'ok' : 'warn',
    title: 'Cross-source data conflicts',
    detail: blocked === 0
      ? 'No stale write was blocked recently.'
      : `${blocked} stale write(s) blocked — a source is answering late.`,
    value: blocked,
    at,
  });

  // 9. Cache pressure.
  const stats = cache.stats();
  const pressure = stats.entries / stats.maxEntries;
  checks.push({
    id: 'cache.pressure',
    level: pressure < 0.9 ? 'ok' : 'warn',
    title: 'Cache pressure',
    detail: `${stats.entries}/${stats.maxEntries} entries in this instance.`,
    value: Math.round(pressure * 100),
    at,
  });

  // 10. The canonical host. A deployment whose SITE_URL still points at
  // localhost or *.vercel.app publishes canonicals, hreflang and a sitemap for
  // the wrong host — invisible in the UI, fatal for indexing, so it is a check
  // and not a comment in a README.
  const siteUrlIssue = siteUrlProblem();
  checks.push({
    id: 'seo.site_url',
    level: siteUrlIssue ? 'warn' : 'ok',
    title: 'Canonical site URL',
    detail: siteUrlIssue ?? `${SITE_URL} (https, production host)`,
    value: SITE_URL,
    at,
  });

  return checks;
}

export interface DiagnosticsReport {
  generatedAt: string;
  environment: string;
  overall: 'ok' | 'warn' | 'critical';
  checks: Observation[];
  sources: ReturnType<typeof catalogSummary>;
  sourceMetrics: Record<string, SourceMetrics>;
  news: { enabled: boolean; sources: ReturnType<typeof newsSourceHealth> };
  matches: { store: ReturnType<typeof matchStoreStats>; conflicts: ReturnType<typeof recentConflicts> };
  entities: { stats: ReturnType<typeof registryStats>; review: ReturnType<typeof ambiguityReview>; conflicts: ReturnType<typeof entityConflicts> };
  cache: ReturnType<typeof cache.stats>;
}

export function diagnosticsReport(): DiagnosticsReport {
  const checks = runChecks();
  const overall = checks.some((c) => c.level === 'critical')
    ? 'critical'
    : checks.some((c) => c.level === 'warn')
      ? 'warn'
      : 'ok';

  return {
    generatedAt: new Date().toISOString(),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    overall,
    checks,
    sources: catalogSummary(),
    sourceMetrics: sourceMetricsSnapshot(),
    news: { enabled: newsEnabled(), sources: newsSourceHealth() },
    matches: { store: matchStoreStats(), conflicts: recentConflicts(25) },
    entities: { stats: registryStats(), review: ambiguityReview(25), conflicts: entityConflicts(25) },
    cache: cache.stats(),
  };
}

/** Emit an alert-worthy observation to the structured log (best effort). */
export function reportChecks(): Observation[] {
  const checks = runChecks();
  for (const check of checks) {
    if (check.level === 'ok') continue;
    log[check.level === 'critical' ? 'error' : 'warn']('observability.check', {
      check: check.id,
      level: check.level,
      detail: check.detail,
      value: check.value,
    });
  }
  return checks;
}

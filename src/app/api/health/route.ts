import { NextResponse } from 'next/server';
import { getHealth } from '@/lib/circuit';
import { cache } from '@/lib/cache';
import { catalogSummary } from '@/lib/providers/catalog';
import { runChecks } from '@/lib/observability';
import { matchStoreStats, recentConflicts } from '@/lib/matchStore';
import { registryStats } from '@/lib/entities';
import { newsEnabled, newsSourceHealth } from '@/lib/news';

export const dynamic = 'force-dynamic';

/**
 * Provider health + circuit breaker state (monitoring).
 *
 * Response is additive compared to the previous version: every existing key
 * (`ok`, `now`, `cache`, `sources`, `providers`) keeps its shape, and the new
 * keys expose the internal checks (stuck live matches, blocked stale writes,
 * empty payloads, rate-limit proximity) plus knowledge-model stats.
 *
 * No secrets, no provider URLs, no keys — safe for its current public use.
 */
export async function GET() {
  const providers = getHealth();
  const up = providers.every((p) => p.state !== 'open');
  const checks = runChecks();
  const critical = checks.filter((c) => c.level === 'critical');

  return NextResponse.json(
    {
      ok: up && critical.length === 0,
      now: new Date().toISOString(),
      cache: cache.stats(),
      sources: catalogSummary(),
      providers: providers.map((p) => ({
        id: p.providerId,
        state: p.state,
        consecutiveFailures: p.consecutiveFailures,
        successes: p.totalSuccesses,
        failures: p.totalFailures,
        avgLatencyMs: p.avgLatencyMs,
        lastSuccessAt: p.lastSuccessAt,
        lastFailureAt: p.lastFailureAt,
        lastError: p.lastError,
        openUntil: p.openedUntil ? new Date(p.openedUntil).toISOString() : null,
      })),
      checks: {
        overall: critical.length > 0 ? 'critical' : checks.some((c) => c.level === 'warn') ? 'warn' : 'ok',
        items: checks.map((check) => ({
          id: check.id,
          level: check.level,
          detail: check.detail,
          value: check.value ?? null,
        })),
      },
      knowledge: {
        entities: registryStats(),
        matches: matchStoreStats(),
        conflicts: recentConflicts(5),
      },
      news: {
        enabled: newsEnabled(),
        sources: newsSourceHealth(),
      },
    },
    { status: up ? 200 : 503 },
  );
}

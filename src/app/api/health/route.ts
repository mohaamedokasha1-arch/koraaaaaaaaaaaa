import { NextResponse } from 'next/server';
import { getHealth } from '@/lib/circuit';
import { cache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

/** Provider health + circuit breaker state (monitoring per spec Phase 5). */
export async function GET() {
  const providers = getHealth();
  const up = providers.every((p) => p.state !== 'open');
  return NextResponse.json(
    {
      ok: up,
      now: new Date().toISOString(),
      cache: cache.stats(),
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
    },
    { status: up ? 200 : 503 },
  );
}

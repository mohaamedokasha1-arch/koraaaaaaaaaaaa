/**
 * Circuit breaker + provider health monitoring (per spec Phase 5).
 * After N consecutive failures the circuit opens for a cooldown period,
 * short-circuiting calls so a sick provider can't stall requests.
 */

export interface ProviderHealth {
  providerId: string;
  state: 'closed' | 'open' | 'half-open';
  consecutiveFailures: number;
  totalSuccesses: number;
  totalFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  openedUntil: number; // epoch ms; 0 when closed
  avgLatencyMs: number;
}

const THRESHOLD = Number(process.env.CIRCUIT_BREAKER_THRESHOLD ?? 5);
const COOLDOWN_MS = Number(process.env.CIRCUIT_BREAKER_COOLDOWN_MS ?? 300_000);

interface Internal extends ProviderHealth {
  latencyTotal: number;
  latencyCount: number;
}

const globalForCircuits = globalThis as unknown as { __koraCircuits?: Map<string, Internal> };
const circuits = globalForCircuits.__koraCircuits ?? (globalForCircuits.__koraCircuits = new Map());

function getInternal(id: string): Internal {
  let c = circuits.get(id);
  if (!c) {
    c = {
      providerId: id,
      state: 'closed',
      consecutiveFailures: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastError: null,
      openedUntil: 0,
      avgLatencyMs: 0,
      latencyTotal: 0,
      latencyCount: 0,
    };
    circuits.set(id, c);
  }
  // auto half-open after cooldown
  if (c.state === 'open' && Date.now() >= c.openedUntil) {
    c.state = 'half-open';
  }
  return c;
}

/** Returns false when the circuit is open and the call should be skipped. */
export function allowRequest(providerId: string): boolean {
  const c = getInternal(providerId);
  return c.state !== 'open';
}

export function recordSuccess(providerId: string, latencyMs: number): void {
  const c = getInternal(providerId);
  c.state = 'closed';
  c.consecutiveFailures = 0;
  c.totalSuccesses += 1;
  c.lastSuccessAt = new Date().toISOString();
  c.lastError = null;
  c.openedUntil = 0;
  c.latencyTotal += latencyMs;
  c.latencyCount += 1;
  c.avgLatencyMs = Math.round(c.latencyTotal / c.latencyCount);
}

export function recordFailure(providerId: string, error: string): void {
  const c = getInternal(providerId);
  c.consecutiveFailures += 1;
  c.totalFailures += 1;
  c.lastFailureAt = new Date().toISOString();
  c.lastError = error;
  if (c.state === 'half-open' || c.consecutiveFailures >= THRESHOLD) {
    c.state = 'open';
    c.openedUntil = Date.now() + COOLDOWN_MS;
  }
}

export function getHealth(): ProviderHealth[] {
  return Array.from(circuits.values()).map((c) => ({
    providerId: c.providerId,
    state: c.state,
    consecutiveFailures: c.consecutiveFailures,
    totalSuccesses: c.totalSuccesses,
    totalFailures: c.totalFailures,
    lastSuccessAt: c.lastSuccessAt,
    lastFailureAt: c.lastFailureAt,
    lastError: c.lastError,
    openedUntil: c.openedUntil,
    avgLatencyMs: c.avgLatencyMs,
  }));
}

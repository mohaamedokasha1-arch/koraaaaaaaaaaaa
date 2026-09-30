import type { FootballProvider } from './base';
import { footballDataProvider } from './footballData';
import { espnProvider } from './espn';
import { theSportsDbProvider } from './theSportsDb';
import { apiFootballProvider } from './apiFootball';
import { allowRequest, recordFailure, recordSuccess } from '@/lib/circuit';
import { ProviderError } from './http';

/** All known adapters. Order within chains below decides the waterfall. */
const adapters: FootballProvider[] = [
  footballDataProvider,
  apiFootballProvider,
  espnProvider,
  theSportsDbProvider,
];

/**
 * Per-capability fallback chains. The primary keyed provider leads;
 * free public providers back it up so the app survives rate limits/outages
 * at zero cost.
 */
const chains: Record<string, string[]> = {
  live: ['fd', 'af', 'espn', 'tsdb'],
  matchesByDate: ['fd', 'af', 'espn', 'tsdb'],
  matchesByRange: ['fd', 'af', 'espn', 'tsdb'],
  match: ['fd', 'af', 'espn', 'tsdb'],
  leagues: ['fd', 'af'],
  // tsdb closes the chain for competitions football-data's free plan does not
  // cover (it declines the featured ones as 'unsupported', so nothing changes
  // for them, and it serves them from its own league tables/schedules).
  leagueMatches: ['fd', 'af', 'tsdb'],
  standings: ['fd', 'af', 'tsdb'],
  scorers: ['fd', 'af'],
  leagueTeams: ['fd', 'af', 'tsdb'],
  team: ['fd', 'tsdb'],
  teamMatches: ['fd', 'tsdb'],
  searchTeams: ['tsdb'],
};

export type Capability = keyof typeof chains;

const byId = new Map(adapters.map((a) => [a.id, a]));

export function getChain(capability: Capability): FootballProvider[] {
  const order = chains[capability] ?? [];
  return order
    .map((id) => byId.get(id))
    .filter((p): p is FootballProvider => Boolean(p) && p!.enabled());
}

export function getProviderById(id: string): FootballProvider | undefined {
  const p = byId.get(id);
  return p && p.enabled() ? p : undefined;
}

/**
 * Run one capability call through its fallback chain:
 * circuit breaker gate → adapter call → health bookkeeping → next on failure.
 * Throws the last error when every enabled provider fails — the service
 * layer then degrades to stale cache or a graceful empty state.
 */
export async function withFallback<T>(
  capability: keyof typeof chains,
  call: (provider: FootballProvider) => Promise<T>,
): Promise<{ data: T; source: string }> {
  const providers = getChain(capability);
  let lastError: Error | null = null;

  for (const provider of providers) {
    if (!allowRequest(provider.id)) {
      lastError = new ProviderError(`circuit open for ${provider.id}`, 'network');
      continue;
    }
    const started = Date.now();
    try {
      const data = await call(provider);
      recordSuccess(provider.id, Date.now() - started);
      return { data, source: provider.id };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      lastError = e;
      // "unsupported"/"plan" are capability gaps, not outages — don't poison the circuit
      if (e instanceof ProviderError && (e.kind === 'unsupported' || e.kind === 'plan')) {
        continue;
      }
      recordFailure(provider.id, e.message.slice(0, 200));
    }
  }
  throw lastError ?? new ProviderError('no enabled provider for capability', 'network');
}

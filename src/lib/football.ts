import 'server-only';
import { cache as reactCache } from 'react';
import type {
  DataResult,
  LeagueSearchHit,
  Scorer,
  SearchHit,
  StandingRow,
  TeamSearchHit,
  UnifiedLeague,
  UnifiedMatch,
  UnifiedTeam,
} from '@/lib/types';
import { CACHE_TTL, cache, getOrSet } from '@/lib/cache';
import { ALL_LEAGUES, decodeEntityId, leagueByCode, leagueEntityId } from '@/lib/constants';
import { getProviderById, withFallback, type Capability } from '@/lib/providers/registry';
import type { FootballProvider } from '@/lib/providers/base';
import { reconcileMatchBatch, reconcileOne } from '@/lib/matchStore';
import { registerFromMatches, registerFromProviderTeam, resolveTeamRoute } from '@/lib/entities';
import { searchUnified } from '@/lib/search';
import { trackSourcePayload } from '@/lib/observability';

/**
 * Service facade — the ONLY data entry point for pages and API routes.
 *
 * Strategy per operation:
 * 1. fresh cache hit             → return
 * 2. provider waterfall          → normalize → cache → return
 * 3. all providers failed        → stale cache (marked) → return
 * 4. nothing available           → throw ServiceError → UI shows graceful state
 *
 * No fabricated data, ever: empty arrays mean "provider truthfully has none".
 */

export class ServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ServiceError';
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return isoDate(new Date());
}

/** cairo-safe "today" — the audience default timezone */
export function localToday(tz = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Africa/Cairo'): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    return fmt.format(new Date());
  } catch {
    return todayISO();
  }
}

/** Match payloads pass through validation/reconciliation and teach the registry. */
function looksLikeMatches(items: unknown[]): boolean {
  const first = items[0] as Partial<UnifiedMatch> | undefined;
  return Boolean(first && typeof first === 'object' && 'utcDate' in first && 'home' in first && 'away' in first);
}

function postProcess<T>(data: T, source: string): T {
  if (Array.isArray(data) && data.length > 0 && looksLikeMatches(data as unknown[])) {
    const reconciled = reconcileMatchBatch(data as unknown as UnifiedMatch[], source);
    registerFromMatches(reconciled, source);
    return reconciled as unknown as T;
  }
  return data;
}

async function cachedCall<T>(
  cacheKey: string,
  ttl: number,
  capability: Capability,
  run: (provider: FootballProvider) => Promise<T>,
): Promise<DataResult<T>> {
  const cached = cache.get<T>(cacheKey);
  if (cached && !cached.stale) {
    return { data: cached.value, source: 'cache', stale: false, fetchedAt: cached.fetchedAt };
  }
  try {
    const { data, source } = await withFallback(capability, run);
    const processed = postProcess(data, source);
    trackSourcePayload(source, Array.isArray(processed) ? processed.length : 0);
    const fetchedAt = cache.set(cacheKey, processed, ttl);
    return { data: processed, source, stale: false, fetchedAt };
  } catch (err) {
    const stale = cache.getStale<T>(cacheKey);
    if (stale != null) {
      return { data: stale.value, source: 'cache', stale: true, fetchedAt: stale.fetchedAt };
    }
    throw new ServiceError(`all providers failed for ${cacheKey}`, err);
  }
}

// ---------------------------------------------------------------- live ----
export async function getLiveMatches(): Promise<DataResult<UnifiedMatch[]>> {
  const result = await cachedCall<UnifiedMatch[]>(
    'live:all',
    CACHE_TTL.LIVE_MATCHES,
    'live',
    (p) => p.getLiveMatches(),
  );
  result.data = [...result.data].sort((a, b) => {
    const la = a.league.name.localeCompare(b.league.name);
    if (la !== 0) return la;
    return a.utcDate.localeCompare(b.utcDate);
  });
  return result;
}

// ------------------------------------------------------------- by date ----
export async function getMatchesByDate(date: string): Promise<DataResult<UnifiedMatch[]>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ServiceError(`bad date: ${date}`);
  const ttl = date < todayISO() ? CACHE_TTL.RESULTS : CACHE_TTL.TODAY_FIXTURES;
  const result = await cachedCall<UnifiedMatch[]>(
    `matches:${date}`,
    ttl,
    'matchesByDate',
    (p) => p.getMatchesByDate(date),
  );
  result.data = [...result.data].sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  return result;
}

/** Localized day bucket (viewer timezone, default Africa/Cairo) for grouping. */
export function localDay(isoUtc: string, tz = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Africa/Cairo'): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(isoUtc));
  } catch {
    return isoUtc.slice(0, 10);
  }
}

function shiftIso(daysDelta: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysDelta);
  return isoDate(d);
}

/**
 * Range query with per-range caching. Football APIs count a RANGE as a single
 * request — far kinder to free-tier budgets than 12 parallel day queries.
 */
export async function getMatchesByRange(from: string, to: string): Promise<DataResult<UnifiedMatch[]>> {
  const today = todayISO();
  const ttl = to < today ? CACHE_TTL.RESULTS : from > today ? CACHE_TTL.UPCOMING : CACHE_TTL.TODAY_FIXTURES;
  return cachedCall<UnifiedMatch[]>(
    `matchesRange:${from}:${to}`,
    ttl,
    'matchesByRange',
    (p) => p.getMatchesByRange(from, to),
  );
}

const RANGE_CHUNK = 9; // days per upstream call (provider-friendly)

function chunkRange(fromIso: string, toIso: string): { from: string; to: string }[] {
  const chunks: { from: string; to: string }[] = [];
  let cursor = new Date(`${fromIso}T00:00:00Z`);
  const end = new Date(`${toIso}T00:00:00Z`);
  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + RANGE_CHUNK - 1);
    const effectiveEnd = chunkEnd > end ? end : chunkEnd;
    chunks.push({ from: isoDate(cursor), to: isoDate(effectiveEnd) });
    cursor = new Date(effectiveEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return chunks;
}

/** Shared range pipeline: fetch chunks → merge dedupe → filter → group by local day. */
async function getGroupedRange(
  offsetStart: number,
  offsetEnd: number,
  keep: (m: UnifiedMatch) => boolean,
  sortDesc: boolean,
): Promise<DataResult<{ date: string; matches: UnifiedMatch[] }[]>> {
  const from = shiftIso(offsetStart);
  const to = shiftIso(offsetEnd);
  const chunks = chunkRange(from, to);

  const settled = await Promise.allSettled(chunks.map((c) => getMatchesByRange(c.from, c.to)));
  const byDay = new Map<string, UnifiedMatch[]>();
  const seen = new Set<string>();

  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    for (const m of r.value.data) {
      if (seen.has(m.id) || !keep(m)) continue;
      seen.add(m.id);
      const day = localDay(m.utcDate);
      if (day < from || day > to) continue;
      const list = byDay.get(day);
      if (list) list.push(m);
      else byDay.set(day, [m]);
    }
  }

  const groups = Array.from(byDay.entries())
    .sort(([a], [b]) => (sortDesc ? b.localeCompare(a) : a.localeCompare(b)))
    .map(([date, matches]) => ({
      date,
      matches: matches.sort((a, b) =>
        sortDesc ? b.utcDate.localeCompare(a.utcDate) : a.utcDate.localeCompare(b.utcDate),
      ),
    }));

  const stale = settled.some(
    (r) => r.status === 'fulfilled' && r.value.stale,
  );
  return { data: groups, source: 'mixed', stale, fetchedAt: new Date().toISOString() };
}

/** next N upcoming days (fixtures view): 2-3 range calls instead of N day calls */
export async function getUpcoming(days = 5): Promise<DataResult<{ date: string; matches: UnifiedMatch[] }[]>> {
  const n = Math.min(Math.max(days, 1), 18);
  return getGroupedRange(1, n, (m) => m.status !== 'finished', false);
}

/** last N days of results, today included (most recent first): 2-3 range calls instead of N day calls */
export async function getResults(days = 3): Promise<DataResult<{ date: string; matches: UnifiedMatch[] }[]>> {
  const n = Math.min(Math.max(days, 1), 18);
  return getGroupedRange(-(n - 1), 0, (m) => m.status === 'finished', true);
}

// --------------------------------------------------------------- match ----
/**
 * Request-memoized so generateMetadata + the page render share ONE provider
 * call (React dedupes per-request). Important for rate-limit friendliness.
 */
export const getMatchMemo = reactCache(async (id: string) => getMatch(id));

export async function getMatch(id: string): Promise<DataResult<UnifiedMatch> | null> {
  const decoded = decodeEntityId(id);
  if (!decoded) return null;
  const cacheKey = `match:${id}`;
  const cached = cache.get<UnifiedMatch>(cacheKey);
  if (cached && !cached.stale) {
    return { data: cached.value, source: 'cache', stale: false, fetchedAt: cached.fetchedAt };
  }
  // only the provider that owns this id can resolve it
  const owner = getProviderById(decoded.provider);
  if (!owner) throw new ServiceError(`provider ${decoded.provider} unavailable`);
  try {
    const match = await owner.getMatch(decoded.parts);
    if (!match) return null;
    const validated = reconcileOne(match, owner.id);
    const fetchedAt = cache.set(cacheKey, validated, CACHE_TTL.MATCH_DETAIL);
    return { data: validated, source: owner.id, stale: false, fetchedAt };
  } catch (err) {
    const stale = cache.getStale<UnifiedMatch>(cacheKey);
    if (stale) return { data: stale.value, source: 'cache', stale: true, fetchedAt: stale.fetchedAt };
    throw err;
  }
}

// -------------------------------------------------------------- leagues ----
export async function getLeagues(): Promise<DataResult<UnifiedLeague[]>> {
  try {
    return await cachedCall<UnifiedLeague[]>('leagues', CACHE_TTL.LEAGUES, 'leagues', (p) => p.getLeagues());
  } catch {
    // zero dependency fallback: the curated list (real, stable data)
    const data: UnifiedLeague[] = ALL_LEAGUES.map((l) => ({
      id: leagueEntityId(l),
      code: l.fdCode,
      name: l.nameEn,
      emblem: l.emblem,
      country: l.country,
      currentSeason: null,
    }));
    return { data, source: 'static', stale: true, fetchedAt: new Date().toISOString() };
  }
}

export async function getLeagueBundle(code: string): Promise<{
  league: UnifiedLeague | null;
  standings: DataResult<StandingRow[]> | null;
  scorers: DataResult<Scorer[]> | null;
  matches: DataResult<UnifiedMatch[]> | null;
}> {
  const featured = leagueByCode(code);
  const league: UnifiedLeague | null = featured
    ? { id: leagueEntityId(featured), code, name: featured.nameEn, emblem: featured.emblem, country: featured.country, currentSeason: null }
    : null;

  const [standings, scorers, matches] = await Promise.all([
    cachedCall<StandingRow[]>(`standings:${code}`, CACHE_TTL.STANDINGS, 'standings', (p) => p.getStandings(code)).catch(() => null),
    cachedCall<Scorer[]>(`scorers:${code}`, CACHE_TTL.TOP_SCORERS, 'scorers', (p) => p.getScorers(code)).catch(() => null),
    cachedCall<UnifiedMatch[]>(`leagueMatches:${code}`, CACHE_TTL.LEAGUE_MATCHES, 'leagueMatches', (p) => p.getLeagueMatches(code)).catch(() => null),
  ]);
  return { league, standings, scorers, matches };
}

export async function getStandings(code: string): Promise<DataResult<StandingRow[]>> {
  return cachedCall<StandingRow[]>(`standings:${code}`, CACHE_TTL.STANDINGS, 'standings', (p) => p.getStandings(code));
}

export async function getScorers(code: string): Promise<DataResult<Scorer[]>> {
  return cachedCall<Scorer[]>(`scorers:${code}`, CACHE_TTL.TOP_SCORERS, 'scorers', (p) => p.getScorers(code));
}

// ---------------------------------------------------------------- teams ----
export async function getLeagueTeams(code: string): Promise<DataResult<UnifiedTeam[]>> {
  const result = await cachedCall<UnifiedTeam[]>(
    `leagueTeams:${code}`,
    CACHE_TTL.TEAM_INFO,
    'leagueTeams',
    (p) => p.getTeams(code),
  );
  for (const team of result.data) registerFromProviderTeam(team, result.source, code);
  return result;
}

/** Request-memoized variant (metadata + render share one provider call). */
export const getTeamMemo = reactCache(async (id: string) => getTeam(id));

export async function getTeam(id: string): Promise<DataResult<UnifiedTeam> | null> {
  // Accepts the entity slug (`al-ahly-eg`) AND the legacy provider id
  // (`fd~57`, `tsdb~138995`) — existing links and indexed URLs keep working.
  const resolved = await resolveTeamRoute(id);
  if (!resolved || !resolved.provider) return null;
  const { provider, parts } = resolved.provider;
  const cacheKey = `team:${resolved.entity.id}`;
  const cached = cache.get<UnifiedTeam>(cacheKey);
  if (cached && !cached.stale) {
    return { data: cached.value, source: 'cache', stale: false, fetchedAt: cached.fetchedAt };
  }
  const owner = getProviderById(provider);
  if (!owner) throw new ServiceError(`provider ${provider} unavailable`);
  try {
    const team = await owner.getTeam(parts);
    if (!team) return null;
    registerFromProviderTeam(
      team,
      owner.id,
      resolved.entity?.leagueCodes?.[0] ?? null,
    );
    const fetchedAt = cache.set(cacheKey, team, CACHE_TTL.TEAM_INFO);
    return { data: team, source: owner.id, stale: false, fetchedAt };
  } catch (err) {
    const stale = cache.getStale<UnifiedTeam>(cacheKey);
    if (stale) return { data: stale.value, source: 'cache', stale: true, fetchedAt: stale.fetchedAt };
    throw err;
  }
}

/** Team fixtures: recent results or upcoming schedule (provider-resolved by id prefix). */
export async function getTeamMatches(
  teamId: string,
  kind: 'recent' | 'upcoming',
): Promise<DataResult<UnifiedMatch[]>> {
  const resolved = await resolveTeamRoute(teamId);
  if (!resolved || !resolved.provider) {
    return { data: [], source: 'none', stale: false, fetchedAt: new Date().toISOString() };
  }
  const { provider, parts } = resolved.provider;
  const owner = getProviderById(provider);
  if (!owner) return { data: [], source: 'none', stale: false, fetchedAt: new Date().toISOString() };
  const ttl = kind === 'recent' ? CACHE_TTL.RESULTS : CACHE_TTL.UPCOMING;
  const cacheKey = `teamMatches:${resolved.entity.id}:${kind}`;
  const cached = cache.get<UnifiedMatch[]>(cacheKey);
  if (cached && !cached.stale) {
    return { data: cached.value, source: 'cache', stale: false, fetchedAt: cached.fetchedAt };
  }
  try {
    const fetchedMatches = await owner.getTeamMatches(parts, kind);
    const matches = reconcileMatchBatch(fetchedMatches, owner.id);
    registerFromMatches(matches, owner.id);
    const fetchedAt = cache.set(cacheKey, matches, ttl);
    return { data: matches, source: owner.id, stale: false, fetchedAt };
  } catch {
    const stale = cache.getStale<UnifiedMatch[]>(cacheKey);
    if (stale) return { data: stale.value, source: 'cache', stale: true, fetchedAt: stale.fetchedAt };
    return { data: [], source: 'none', stale: false, fetchedAt: new Date().toISOString() };
  }
}

// --------------------------------------------------------------- search ----
/**
 * Legacy entry point kept for API compatibility: it now delegates to the
 * entity-aware unified search and returns the same `SearchHit[]` shape it always
 * returned, so `/api/search` clients and the type-ahead box are untouched.
 */
export async function search(query: string): Promise<DataResult<SearchHit[]>> {
  const unified = await searchUnified(query);
  const hits: SearchHit[] = [
    ...unified.data.leagues.map((league) => ({
      kind: 'league' as const,
      id: league.id,
      code: league.code,
      name: league.name,
      emblem: league.emblem,
      country: league.country,
    })),
    ...unified.data.teams.map((team) => ({
      kind: 'team' as const,
      id: team.id,
      name: team.name,
      crest: team.crest,
      league: team.league,
      country: team.country,
    })),
  ].slice(0, 15);
  return {
    data: hits,
    source: unified.source,
    stale: unified.stale,
    fetchedAt: unified.fetchedAt,
  };
}

export { CACHE_TTL, getOrSet };

import type { DataResult, NewsEntry, UnifiedMatch } from '../../../lib/types.ts';
import { isValidTimeZone, localDayInZone } from '../../../lib/pure/time.ts';
import { hasErrors, validateMatch } from '../../../lib/pure/validation.ts';
import {
  MAX_FAVORITES, isLeagueCode, isProviderTeamId, isTeamFavoriteId, type Preferences,
} from './preferences.ts';

export interface DashboardSelection {
  teams: { id: string; providerId: string | null }[];
  leagues: string[];
}
export interface MatchSnapshot {
  match: UnifiedMatch;
  stale: boolean;
  fetchedAt: string;
  source: string;
}
export interface DashboardResponse {
  version: 1;
  day: string;
  timeZone: string;
  live: MatchSnapshot[];
  fixtures: MatchSnapshot[];
  results: MatchSnapshot[];
  coverage: 'complete' | 'partial' | 'unavailable';
  liveAvailable: boolean;
  fetchedAt: string | null;
  news: NewsEntry[];
  newsStatus: 'disabled' | 'available' | 'unavailable';
  newsStale: boolean;
  newsFetchedAt: string | null;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
export function parseDashboardSelection(input: unknown): DashboardSelection | null {
  if (!record(input) || !Array.isArray(input.teams) || !Array.isArray(input.leagues) ||
      input.teams.length + input.leagues.length > MAX_FAVORITES) return null;
  const teams: DashboardSelection['teams'] = [];
  for (const value of input.teams) {
    if (!record(value) || !isTeamFavoriteId(value.id) ||
        (value.providerId !== null && !isProviderTeamId(value.providerId))) return null;
    if (!teams.some((entry) => entry.id === value.id || Boolean(entry.providerId && entry.providerId === value.providerId))) {
      teams.push({ id: value.id, providerId: value.providerId as string | null });
    }
  }
  if (!input.leagues.every(isLeagueCode)) return null;
  return { teams, leagues: [...new Set(input.leagues as string[])] };
}
export function selectionForPreferences(preferences: Preferences): DashboardSelection {
  return {
    teams: preferences.favorites.filter((entry) => entry.kind === 'team')
      .map((entry) => ({ id: entry.id, providerId: entry.providerId })).sort((a, b) => a.id.localeCompare(b.id)),
    leagues: preferences.favorites.filter((entry) => entry.kind === 'league')
      .map((entry) => entry.leagueCode!).sort(),
  };
}

export function shiftDay(day: string, offset: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function zoneOffsetAt(iso: string, timeZone: string): number {
  const instant = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value);
  return Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second')) - instant.getTime();
}
/** At most three UTC buckets (usually two); local midnight, including DST, wins. */
export function utcDatesForLocalDay(day: string, timeZone: string): string[] {
  const offsets = [zoneOffsetAt(`${day}T00:00:00Z`, timeZone), zoneOffsetAt(`${day}T23:59:59Z`, timeZone)];
  return [
    ...(offsets.some((offset) => offset > 0) ? [shiftDay(day, -1)] : []),
    day,
    ...(offsets.some((offset) => offset < 0) ? [shiftDay(day, 1)] : []),
  ];
}

export interface DashboardInputs {
  day: string;
  timeZone: string;
  now: number;
  selection: DashboardSelection;
  daily: (DataResult<UnifiedMatch[]> | null)[];
  live: DataResult<UnifiedMatch[]> | null;
  news: DataResult<NewsEntry[]> | null;
  newsEnabled: boolean;
  /** Proven registry refs only; no fuzzy name matching. */
  entityIdForTeam: (providerId: string) => string | null;
}

export function buildDashboard(input: DashboardInputs): DashboardResponse {
  const ids = new Set(input.selection.teams.map((team) => team.id));
  const refs = new Set(input.selection.teams.map((team) => team.providerId).filter((ref): ref is string => ref !== null));
  const leagues = new Set(input.selection.leagues);
  for (const ref of refs) {
    const id = input.entityIdForTeam(ref);
    if (id) ids.add(id);
  }
  const follows = (match: UnifiedMatch) => leagues.has(match.league.code ?? '') ||
    [match.home.id, match.away.id].some((ref) => refs.has(ref) || ids.has(input.entityIdForTeam(ref) ?? ''));
  const byId = new Map<string, MatchSnapshot>();
  const sources = [...input.daily, input.live].filter((entry): entry is DataResult<UnifiedMatch[]> => entry !== null);
  for (const source of sources) {
    for (const match of source.data) {
      if (!follows(match)) continue;
      const live = match.status === 'live' || match.status === 'halftime';
      if (!live && localDayInZone(match.utcDate, input.timeZone) !== input.day) continue;
      const candidate = {
        match, fetchedAt: source.fetchedAt, source: source.source,
        stale: source.stale || (live && input.now - Date.parse(match.lastUpdated) > 25 * 60_000),
      };
      const previous = byId.get(match.id);
      const changed = previous ? Date.parse(match.lastUpdated) - Date.parse(previous.match.lastUpdated) : 1;
      if (!previous || changed > 0 || (changed === 0 && Date.parse(candidate.fetchedAt) > Date.parse(previous.fetchedAt))) {
        byId.set(match.id, candidate);
      }
    }
  }
  const all = [...byId.values()].sort((a, b) => Date.parse(a.match.utcDate) - Date.parse(b.match.utcDate));
  const datesLoaded = input.daily.filter(Boolean).length;
  const coverage = datesLoaded === input.daily.length && datesLoaded > 0
    ? 'complete' : datesLoaded > 0 || Boolean(input.live) ? 'partial' : 'unavailable';
  const newsIds = new Set([...ids, ...input.selection.leagues.map((code) => `league:${code.toLowerCase()}`)]);
  const news = input.news?.data.filter((entry) => entry.entities.some((entity) => newsIds.has(entity.id))).slice(0, 6) ?? [];
  return {
    version: 1, day: input.day, timeZone: input.timeZone,
    live: all.filter((entry) => entry.match.status === 'live' || entry.match.status === 'halftime').slice(0, 6),
    fixtures: all.filter((entry) => !['live', 'halftime', 'finished'].includes(entry.match.status)).slice(0, 8),
    results: all.filter((entry) => entry.match.status === 'finished').reverse().slice(0, 6),
    coverage, liveAvailable: input.live !== null,
    // Oldest successful source snapshot, not the time this response was generated.
    fetchedAt: sources.map((source) => source.fetchedAt).sort()[0] ?? null,
    news, newsStatus: !input.newsEnabled ? 'disabled' : input.news ? 'available' : 'unavailable',
    newsStale: input.news?.stale ?? false, newsFetchedAt: input.news?.fetchedAt ?? null,
  };
}

function iso(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
}
function label(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200;
}
function safeWebUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}
function validDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function snapshot(value: unknown): boolean {
  if (!record(value) || typeof value.stale !== 'boolean' || !iso(value.fetchedAt) || !label(value.source) || !record(value.match)) return false;
  const m = value.match;
  if (!label(m.id) || !/^[a-z0-9][a-z0-9_.~-]*$/i.test(m.id) || !label(m.provider) || !iso(m.utcDate) || !iso(m.lastUpdated) ||
      !['scheduled', 'live', 'halftime', 'finished', 'postponed', 'cancelled'].includes(m.status as string) ||
      !record(m.home) || !record(m.away) || !record(m.score) || !record(m.league) ||
      !label(m.home.id) || !label(m.away.id) || !label(m.home.name) || !label(m.away.name) || !label(m.league.name) ||
      !Array.isArray(m.events) || (m.minute !== null && !Number.isInteger(m.minute)) ||
      (m.matchday !== null && (!Number.isInteger(m.matchday) || Number(m.matchday) < 0 || Number(m.matchday) > 1000)) ||
      (m.league.emblem != null && !safeWebUrl(m.league.emblem))) return false;
  for (const score of [m.score.home, m.score.away]) if (score !== null && typeof score !== 'number') return false;
  for (const side of [m.home, m.away]) if (side.crest != null && !safeWebUrl(side.crest)) return false;
  return !hasErrors(validateMatch(m as unknown as UnifiedMatch));
}
/** A malformed HTTP 200 must render an error, not crash or assert live truth. */
export function isDashboardResponse(value: unknown): value is DashboardResponse {
  if (!record(value) || value.version !== 1 || !validDay(value.day) ||
      typeof value.timeZone !== 'string' || !isValidTimeZone(value.timeZone) ||
      !['complete', 'partial', 'unavailable'].includes(value.coverage as string) || typeof value.liveAvailable !== 'boolean' ||
      (value.fetchedAt !== null && !iso(value.fetchedAt)) || typeof value.newsStale !== 'boolean' ||
      !['disabled', 'available', 'unavailable'].includes(value.newsStatus as string) ||
      (value.newsFetchedAt !== null && !iso(value.newsFetchedAt))) return false;
  for (const [group, limit] of [[value.live, 6], [value.fixtures, 8], [value.results, 6]] as const) {
    if (!Array.isArray(group) || group.length > limit || !group.every(snapshot)) return false;
  }
  if (!Array.isArray(value.news) || value.news.length > 6) return false;
  return value.news.every((entry) => record(entry) && label(entry.id) && label(entry.title) && label(entry.source) &&
    safeWebUrl(entry.url) && safeWebUrl(entry.sourceUrl) && typeof entry.excerpt === 'string' && entry.excerpt.length <= 500 &&
    (entry.publishedAt === null || iso(entry.publishedAt)));
}

export function snapshotIsStale(entry: MatchSnapshot, now: number, online: boolean): boolean {
  const live = entry.match.status === 'live' || entry.match.status === 'halftime';
  return !online || entry.stale || now - Date.parse(entry.fetchedAt) > (live ? 60_000 : 300_000);
}

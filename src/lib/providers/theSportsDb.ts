import type { MatchStatus, StandingRow, UnifiedMatch, UnifiedTeam } from '@/lib/types';
import {
  encodeEntityId,
  featuredByTsdbId,
  isFdCovered,
  leagueByCode,
  leagueEntityId,
  type FeaturedLeague,
} from '@/lib/constants';
import type { FootballProvider } from './base';
import { fetchJson, ProviderError } from './http';

/**
 * TheSportsDB public API — no registration needed with the public key "3".
 * Fallback for fixtures/results by date and the team search provider
 * (its searchteams endpoint is the only free full-text team search around).
 */

const KEY = process.env.THESPORTSDB_API_KEY || '3';
const BASE = `https://www.thesportsdb.com/api/v1/json/${KEY}`;

interface TsdbEvent {
  idEvent: string;
  strEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  idHomeTeam?: string;
  idAwayTeam?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  dateEvent?: string;
  strTime?: string;
  strTimestamp?: string;
  strStatus?: string; // "FT", "NS", "1H" etc
  strProgress?: string;
  idLeague?: string;
  strLeague?: string;
  strVenue?: string | null;
  strHomeTeamBadge?: string | null;
  strAwayTeamBadge?: string | null;
}

interface TsdbTeam {
  idTeam: string;
  strTeam: string;
  strTeamShort?: string | null;
  strBadge?: string | null;
  strLeague?: string | null;
  idLeague?: string | null;
  strCountry?: string | null;
  intFormedYear?: string | null;
  strStadium?: string | null;
  strWebsite?: string | null;
  strManager?: string | null;
}

interface TsdbStanding {
  intRank?: string | null;
  idTeam?: string | null;
  strTeam?: string | null;
  strBadge?: string | null;
  strForm?: string | null;
  strDescription?: string | null;
  intPlayed?: string | null;
  intWin?: string | null;
  intDraw?: string | null;
  intLoss?: string | null;
  intGoalsFor?: string | null;
  intGoalsAgainst?: string | null;
  intGoalDifference?: string | null;
  intPoints?: string | null;
}

function badge(b: string | null | undefined): string | null {
  return b ? `${b}/tiny` : null;
}

/** TheSportsDB ships schedule/table numbers as strings. */
const int = (v: string | null | undefined): number => {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Season labels for competitions that run on a European calendar
 * (e.g. "2026-2027"); the season flips in July.
 */
function seasonCandidates(): string[] {
  const now = new Date();
  const year = now.getUTCFullYear();
  const start = now.getUTCMonth() >= 6 ? year : year - 1;
  return [`${start}-${start + 1}`, `${start - 1}-${start}`];
}

/**
 * TheSportsDB is the registered data source for the competitions that are NOT on
 * football-data.org's free plan (EXTRA_LEAGUES). Featured competitions keep their
 * own primary + fallback chain, so this adapter declines them with 'unsupported'
 * (a capability gap — it never trips the circuit breaker).
 */
function tsdbLeagueFor(code: string): FeaturedLeague {
  const league = leagueByCode(code);
  if (!league || isFdCovered(league.fdCode)) {
    throw new ProviderError(`thesportsdb league data not mapped for ${code}`, 'unsupported');
  }
  return league;
}

/** Table rows flagged by the provider's own description text, never guessed. */
function zoneOf(description: string | null | undefined): StandingRow['zone'] {
  const d = (description ?? '').toLowerCase();
  if (/relegat|rebaixamento|descenso/.test(d)) return 'relegation';
  if (/champions league|libertadores|caf champions|afc champions|europa league|conference league/.test(d)) {
    return 'champions';
  }
  return null;
}

function mapStanding(r: TsdbStanding): StandingRow {
  const goalsFor = int(r.intGoalsFor);
  const goalsAgainst = int(r.intGoalsAgainst);
  return {
    position: int(r.intRank),
    team: {
      id: encodeEntityId('tsdb', r.idTeam ?? r.strTeam ?? ''),
      name: r.strTeam ?? '',
      shortName: null,
      crest: r.strBadge ?? null,
    },
    played: int(r.intPlayed),
    won: int(r.intWin),
    draw: int(r.intDraw),
    lost: int(r.intLoss),
    goalsFor,
    goalsAgainst,
    goalDifference: r.intGoalDifference != null && r.intGoalDifference !== ''
      ? int(r.intGoalDifference)
      : goalsFor - goalsAgainst,
    points: int(r.intPoints),
    form: r.strForm ?? null,
    zone: zoneOf(r.strDescription),
    group: null,
  };
}

function mapStatus(e: TsdbEvent): MatchStatus {
  const s = (e.strStatus ?? '').toUpperCase();
  if (s === 'FT' || s === 'AET' || s === 'PEN') return 'finished';
  if (s === 'HT') return 'halftime';
  if (s === 'NS' || s === '') return 'scheduled';
  if (s === 'PST' || s === 'POSTP') return 'postponed';
  if (s === 'CANC') return 'cancelled';
  if (/^\d/.test(s) || s === '1H' || s === '2H' || s === 'ET' || s === 'LIVE') return 'live';
  return 'scheduled';
}

function eventDate(e: TsdbEvent): string {
  if (e.strTimestamp) return new Date(e.strTimestamp).toISOString();
  const d = e.dateEvent ?? '';
  const t = (e.strTime ?? '00:00:00').replace(/^24:/, '00:');
  return new Date(`${d}T${t}Z`).toISOString();
}

function mapEvent(e: TsdbEvent): UnifiedMatch {
  const featured = e.idLeague ? featuredByTsdbId(e.idLeague) : undefined;
  const status = mapStatus(e);
  const played = status !== 'scheduled';
  return {
    id: encodeEntityId('tsdb', e.idEvent),
    provider: 'tsdb',
    providerId: e.idEvent,
    utcDate: eventDate(e),
    status,
    minute: null,
    home: {
      id: e.idHomeTeam ? encodeEntityId('tsdb', e.idHomeTeam) : '',
      name: e.strHomeTeam ?? '',
      shortName: null,
      crest: badge(e.strHomeTeamBadge),
    },
    away: {
      id: e.idAwayTeam ? encodeEntityId('tsdb', e.idAwayTeam) : '',
      name: e.strAwayTeam ?? '',
      shortName: null,
      crest: badge(e.strAwayTeamBadge),
    },
    score: {
      home: played && e.intHomeScore != null && e.intHomeScore !== '' ? Number(e.intHomeScore) : null,
      away: played && e.intAwayScore != null && e.intAwayScore !== '' ? Number(e.intAwayScore) : null,
    },
    league: {
      id: featured ? leagueEntityId(featured) : e.idLeague ? encodeEntityId('tsdb', e.idLeague) : '',
      code: featured?.fdCode ?? null,
      name: e.strLeague ?? featured?.nameEn ?? '',
      emblem: featured?.emblem ?? null,
      country: featured?.country ?? null,
    },
    matchday: null,
    venue: e.strVenue ?? null,
    referee: null,
    events: [],
    lastUpdated: new Date().toISOString(),
  };
}

/** League code for a tsdb league id — resolved only for the competitions this
 *  adapter is the registered data source of. */
function leagueCodeForTsdbId(idLeague: string | null | undefined): string | null {
  if (!idLeague) return null;
  const league = featuredByTsdbId(idLeague);
  return league && !isFdCovered(league.fdCode) ? league.fdCode : null;
}

function mapTeam(t: TsdbTeam, leagueCode: string | null = null): UnifiedTeam {
  return {
    id: encodeEntityId('tsdb', t.idTeam),
    provider: 'tsdb',
    providerId: t.idTeam,
    name: t.strTeam,
    shortName: t.strTeamShort ?? null,
    crest: badge(t.strBadge),
    country: t.strCountry ?? null,
    founded: t.intFormedYear ? Number(t.intFormedYear) : null,
    venue: t.strStadium ?? null,
    website: t.strWebsite || null,
    coach: t.strManager ?? null,
    squad: [],
    leagueCode: leagueCode ?? leagueCodeForTsdbId(t.idLeague),
  };
}

export const theSportsDbProvider: FootballProvider = {
  id: 'tsdb',
  name: 'TheSportsDB',
  enabled: () => true,

  async getLiveMatches(): Promise<UnifiedMatch[]> {
    // livescore endpoint is paywalled; degrade to "today's matches that are in progress"
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetchJson<{ event?: TsdbEvent[] }>(`${BASE}/eventsday.php?d=${today}&s=Soccer`);
    return (res.event ?? []).map(mapEvent).filter((m) => m.status === 'live' || m.status === 'halftime');
  },

  async getMatchesByDate(date: string): Promise<UnifiedMatch[]> {
    const res = await fetchJson<{ event?: TsdbEvent[]; events?: TsdbEvent[] }>(
      `${BASE}/eventsday.php?d=${date}&s=Soccer`,
    );
    const list = res.event ?? res.events ?? [];
    return list
      .map(mapEvent)
      .filter((m) => m.home.name && m.away.name)
      .sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  },

  /** per-day fan-out (free tier is day-scoped); loud failure like ESPN. */
  async getMatchesByRange(from: string, to: string): Promise<UnifiedMatch[]> {
    const days: string[] = [];
    for (let d = new Date(`${from}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      if (iso > to || days.length >= 14) break;
      days.push(iso);
    }
    const results = await Promise.allSettled(days.map((d) => this.getMatchesByDate(d)));
    const succeeded = results.filter((r) => r.status === 'fulfilled');
    if (succeeded.length === 0) {
      throw new ProviderError(`thesportsdb unreachable for ${from}..${to}`, 'network');
    }
    const matches: UnifiedMatch[] = [];
    const seen = new Set<string>();
    for (const r of succeeded) {
      for (const m of (r as PromiseFulfilledResult<UnifiedMatch[]>).value) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          matches.push(m);
        }
      }
    }
    return matches.sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  },

  async getMatch(parts: string[]): Promise<UnifiedMatch | null> {
    const [id] = parts;
    if (!id) throw new ProviderError('missing tsdb event id', 'http', 400);
    const res = await fetchJson<{ events?: TsdbEvent[]; event?: TsdbEvent[] }>(
      `${BASE}/lookupevent.php?id=${encodeURIComponent(id)}`,
    );
    const e = (res.events ?? res.event ?? [])[0];
    return e ? mapEvent(e) : null;
  },

  async getTeam(parts: string[]): Promise<UnifiedTeam | null> {
    const [id] = parts;
    if (!id) throw new ProviderError('missing tsdb team id', 'http', 400);
    const res = await fetchJson<{ teams?: TsdbTeam[] }>(`${BASE}/lookupteam.php?id=${encodeURIComponent(id)}`);
    const t = res.teams?.[0];
    return t ? mapTeam(t) : null;
  },

  async searchTeams(query: string): Promise<UnifiedTeam[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const res = await fetchJson<{ teams?: TsdbTeam[] }>(
      `${BASE}/searchteams.php?t=${encodeURIComponent(q)}`,
    );
    return (res.teams ?? [])
      .filter((t) => /soccer/i.test((t as unknown as { strSport?: string }).strSport ?? 'Soccer'))
      .slice(0, 12)
      .map((t) => mapTeam(t));
  },

  async getTeamMatches(parts: string[], kind: 'recent' | 'upcoming'): Promise<UnifiedMatch[]> {
    const [id] = parts;
    if (!id) throw new ProviderError('missing tsdb team id', 'http', 400);
    const endpoint = kind === 'recent' ? 'eventslast.php' : 'eventsnext.php';
    const res = await fetchJson<{ results?: TsdbEvent[]; events?: TsdbEvent[] }>(
      `${BASE}/${endpoint}?id=${encodeURIComponent(id)}`,
    );
    return (res.results ?? res.events ?? [])
      .map(mapEvent)
      .filter((m) => m.home.name && m.away.name);
  },

  async getLeagues() { throw new ProviderError('not supported', 'unsupported'); },

  /**
   * League table. The public key caps this endpoint at 5 rows and the full table
   * is unlocked by a Patreon key (THESPORTSDB_API_KEY), so the adapter returns
   * whatever the plan authorises — never padded, never fabricated.
   */
  async getStandings(code: string): Promise<StandingRow[]> {
    const league = tsdbLeagueFor(code);
    for (const season of seasonCandidates()) {
      const res = await fetchJson<{ table?: TsdbStanding[] | null }>(
        `${BASE}/lookuptable.php?l=${encodeURIComponent(league.tsdbId)}&s=${encodeURIComponent(season)}`,
      );
      const rows = (res.table ?? []).map(mapStanding).filter((r) => r.team.name);
      if (rows.length > 0) return rows;
    }
    return [];
  },

  /**
   * League schedule: the season's events (full list on a supporter key) merged
   * with the provider's most recent result and next fixture, so the page is
   * fresh even on the free tier. Per-day fan-out is avoided on purpose —
   * the day endpoint is capped at a handful of events globally.
   */
  async getLeagueMatches(code: string): Promise<UnifiedMatch[]> {
    const league = tsdbLeagueFor(code);
    const id = encodeURIComponent(league.tsdbId);
    const [season, past, next] = await Promise.allSettled([
      fetchJson<{ events?: TsdbEvent[] | null }>(
        `${BASE}/eventsseason.php?id=${id}&s=${encodeURIComponent(seasonCandidates()[0])}`,
      ),
      fetchJson<{ events?: TsdbEvent[] | null }>(`${BASE}/eventspastleague.php?id=${id}`),
      fetchJson<{ events?: TsdbEvent[] | null }>(`${BASE}/eventsnextleague.php?id=${id}`),
    ]);

    const lists = [season, past, next].flatMap((r) =>
      r.status === 'fulfilled' ? [r.value.events ?? []] : [],
    );
    if (lists.length === 0) {
      throw new ProviderError(`thesportsdb league schedule unreachable for ${code}`, 'network');
    }

    const seen = new Set<string>();
    const matches: UnifiedMatch[] = [];
    for (const e of lists.flat()) {
      if (!e?.idEvent || seen.has(e.idEvent)) continue;
      seen.add(e.idEvent);
      const m = mapEvent(e);
      if (m.home.name && m.away.name) matches.push(m);
    }
    return matches.sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  },

  /** Clubs of a league (the free key returns the first 10; a key returns all). */
  async getTeams(code: string): Promise<UnifiedTeam[]> {
    const league = tsdbLeagueFor(code);
    if (!league.tsdbName) {
      throw new ProviderError(`thesportsdb team list needs a league name for ${code}`, 'unsupported');
    }
    const res = await fetchJson<{ teams?: TsdbTeam[] | null }>(
      `${BASE}/search_all_teams.php?l=${encodeURIComponent(league.tsdbName)}`,
    );
    return (res.teams ?? [])
      .filter((t) => t?.idTeam && t.strTeam)
      .map((t) => mapTeam(t, league.fdCode));
  },

  async getScorers() { throw new ProviderError('not supported', 'unsupported'); },
};

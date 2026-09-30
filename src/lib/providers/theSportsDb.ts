import type { MatchStatus, UnifiedMatch, UnifiedTeam } from '@/lib/types';
import { encodeEntityId, featuredByTsdbId } from '@/lib/constants';
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
  strCountry?: string | null;
  intFormedYear?: string | null;
  strStadium?: string | null;
  strWebsite?: string | null;
  strManager?: string | null;
}

function badge(b: string | null | undefined): string | null {
  return b ? `${b}/tiny` : null;
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
      id: featured ? encodeEntityId('fd', featured.fdCode) : e.idLeague ? encodeEntityId('tsdb', e.idLeague) : '',
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

function mapTeam(t: TsdbTeam): UnifiedTeam {
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
    leagueCode: null,
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
      .map(mapTeam);
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
  async getLeagueMatches() { throw new ProviderError('not supported', 'unsupported'); },
  async getStandings() { throw new ProviderError('not supported', 'unsupported'); },
  async getScorers() { throw new ProviderError('not supported', 'unsupported'); },
  async getTeams() { throw new ProviderError('not supported', 'unsupported'); },
};

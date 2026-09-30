import type { MatchStatus, Scorer, StandingRow, UnifiedMatch, UnifiedTeam } from '@/lib/types';
import { encodeEntityId, leagueByCode } from '@/lib/constants';
import type { FootballProvider } from './base';
import { fetchJson, ProviderError } from './http';

/**
 * api-football (API-SPORTS direct) — optional keyed provider.
 * Automatically disabled unless API_FOOTBALL_KEY is configured.
 */

const KEY = process.env.API_FOOTBALL_KEY;
const BASE = 'https://v3.football.api-sports.io';

interface AfFixture {
  fixture: {
    id: number; date: string; referee?: string | null; venue?: { name?: string | null };
    status: { short?: string; long?: string; elapsed?: number | null };
  };
  league: { id: number; name: string; country?: string; logo?: string; round?: string };
  teams: {
    home: { id: number; name: string; logo?: string };
    away: { id: number; name: string; logo?: string };
  };
  goals: { home: number | null; away: number | null };
  score?: {
    halftime?: { home: number | null; away: number | null };
    penalty?: { home: number | null; away: number | null };
  };
}

function mapStatus(s?: string): MatchStatus {
  switch (s) {
    case '1H': case '2H': case 'ET': case 'P': case 'LIVE': case 'INT': return 'live';
    case 'HT': case 'BT': return 'halftime';
    case 'FT': case 'AET': case 'PEN': return 'finished';
    case 'PST': return 'postponed';
    case 'CANC': case 'ABD': case 'AWD': case 'WO': return 'cancelled';
    default: return 'scheduled';
  }
}

function mapFixture(f: AfFixture): UnifiedMatch {
  return {
    id: encodeEntityId('af', f.fixture.id),
    provider: 'af',
    providerId: String(f.fixture.id),
    utcDate: f.fixture.date,
    status: mapStatus(f.fixture.status.short),
    minute: f.fixture.status.elapsed ?? null,
    home: {
      id: encodeEntityId('af', f.teams.home.id), name: f.teams.home.name,
      shortName: null, crest: f.teams.home.logo ?? null,
    },
    away: {
      id: encodeEntityId('af', f.teams.away.id), name: f.teams.away.name,
      shortName: null, crest: f.teams.away.logo ?? null,
    },
    score: {
      home: f.goals.home, away: f.goals.away,
      htHome: f.score?.halftime?.home ?? null, htAway: f.score?.halftime?.away ?? null,
      pensHome: f.score?.penalty?.home ?? null, pensAway: f.score?.penalty?.away ?? null,
    },
    league: {
      id: encodeEntityId('af', f.league.id), code: null,
      name: f.league.name, emblem: f.league.logo ?? null, country: f.league.country ?? null,
    },
    matchday: null,
    venue: f.fixture.venue?.name ?? null,
    referee: f.fixture.referee ?? null,
    events: [],
    lastUpdated: new Date().toISOString(),
  };
}

async function api<T>(path: string): Promise<T> {
  if (!KEY) throw new ProviderError('api-football key missing', 'auth');
  return fetchJson<T>(`${BASE}${path}`, { headers: { 'x-apisports-key': KEY } });
}

/**
 * api-football keys competitions by numeric id. Route codes we have a mapping
 * for resolve through the league registry (e.g. the Egyptian Premier League is
 * league 233); raw numeric ids keep working exactly as before.
 * Seasons are labelled by their starting year; the flip happens in July.
 */
function afLeague(code: string): { id: string; season: number } | null {
  if (/^\d+$/.test(code)) return { id: code, season: new Date().getFullYear() };
  const league = leagueByCode(code);
  if (!league?.afLeagueId) return null;
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return { id: league.afLeagueId, season: startYear };
}

function requireAfLeague(code: string): { id: string; season: number } {
  const ref = afLeague(code);
  if (!ref) throw new ProviderError(`api-football has no league mapping for ${code}`, 'unsupported');
  return ref;
}

export const apiFootballProvider: FootballProvider = {
  id: 'af',
  name: 'api-football',
  enabled: () => Boolean(KEY),

  async getLiveMatches(): Promise<UnifiedMatch[]> {
    const res = await api<{ response: AfFixture[] }>('/fixtures?live=all');
    return (res.response ?? []).map(mapFixture);
  },

  async getMatchesByDate(date: string): Promise<UnifiedMatch[]> {
    return this.getMatchesByRange(date, date);
  },

  async getMatchesByRange(from: string, to: string): Promise<UnifiedMatch[]> {
    const res = await api<{ response: AfFixture[] }>(`/fixtures?from=${from}&to=${to}`);
    return (res.response ?? []).map(mapFixture);
  },

  async getMatch(parts: string[]): Promise<UnifiedMatch | null> {
    const [id] = parts;
    const res = await api<{ response: AfFixture[] }>(`/fixtures?id=${encodeURIComponent(id ?? '')}`);
    const f = res.response?.[0];
    return f ? mapFixture(f) : null;
  },

  async getStandings(code: string): Promise<StandingRow[]> {
    interface AfStanding {
      league?: {
        standings?: {
          rank: number; team: { id: number; name: string; logo?: string };
          all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
          goalsDiff: number; points: number; form?: string | null; description?: string | null;
        }[][];
      };
    }
    const ref = requireAfLeague(code);
    const res = await api<{ response: AfStanding[] }>(`/standings?league=${ref.id}&season=${ref.season}`);
    const groups = res.response?.[0]?.league?.standings ?? [];
    const rows: StandingRow[] = [];
    for (const group of groups) {
      for (const r of group) {
        rows.push({
          position: r.rank,
          team: { id: encodeEntityId('af', r.team.id), name: r.team.name, shortName: null, crest: r.team.logo ?? null },
          played: r.all.played, won: r.all.win, draw: r.all.draw, lost: r.all.lose,
          goalsFor: r.all.goals.for, goalsAgainst: r.all.goals.against,
          goalDifference: r.goalsDiff, points: r.points,
          form: r.form ?? null, zone: null, group: null,
        });
      }
    }
    return rows;
  },

  async getLeagues() { throw new ProviderError('not supported', 'unsupported'); },

  async getLeagueMatches(code: string): Promise<UnifiedMatch[]> {
    const ref = requireAfLeague(code);
    const res = await api<{ response: AfFixture[] }>(`/fixtures?league=${ref.id}&season=${ref.season}`);
    return (res.response ?? []).map(mapFixture);
  },

  async getScorers(code: string): Promise<Scorer[]> {
    interface AfScorer {
      player: { id?: number; name?: string };
      statistics?: {
        team?: { id?: number; name?: string; logo?: string };
        goals?: { total?: number | null; assists?: number | null };
        penalty?: { scored?: number | null };
        games?: { appearences?: number | null };
      }[];
    }
    const ref = requireAfLeague(code);
    const res = await api<{ response: AfScorer[] }>(`/players/topscorers?league=${ref.id}&season=${ref.season}`);
    return (res.response ?? []).map((s, i) => {
      const stat = s.statistics?.[0];
      return {
        rank: i + 1,
        playerId: s.player?.id != null ? String(s.player.id) : null,
        name: s.player?.name ?? '—',
        team: {
          id: stat?.team?.id != null ? encodeEntityId('af', stat.team.id) : '',
          name: stat?.team?.name ?? '',
          shortName: null,
          crest: stat?.team?.logo ?? null,
        },
        goals: stat?.goals?.total ?? 0,
        assists: stat?.goals?.assists ?? null,
        penalties: stat?.penalty?.scored ?? null,
        played: stat?.games?.appearences ?? null,
      };
    });
  },

  async getTeams(code: string): Promise<UnifiedTeam[]> {
    interface AfTeamEntry {
      team?: { id?: number; name?: string; code?: string | null; country?: string | null; founded?: number | null; logo?: string | null };
      venue?: { name?: string | null };
    }
    const ref = requireAfLeague(code);
    const res = await api<{ response: AfTeamEntry[] }>(`/teams?league=${ref.id}&season=${ref.season}`);
    return (res.response ?? [])
      .filter((e) => e.team?.id != null && e.team.name)
      .map((e) => ({
        id: encodeEntityId('af', e.team!.id!),
        provider: 'af',
        providerId: String(e.team!.id),
        name: e.team!.name!,
        shortName: e.team!.code ?? null,
        crest: e.team!.logo ?? null,
        country: e.team!.country ?? null,
        founded: e.team!.founded ?? null,
        venue: e.venue?.name ?? null,
        website: null,
        coach: null,
        squad: [],
        leagueCode: code,
      }));
  },

  async getTeam() { throw new ProviderError('not supported', 'unsupported'); },
  async getTeamMatches() { throw new ProviderError('not supported', 'unsupported'); },
  async searchTeams() { throw new ProviderError('not supported', 'unsupported'); },
};

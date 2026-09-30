import type {
  MatchEvent,
  MatchStatus,
  Scorer,
  SquadPlayer,
  StandingRow,
  UnifiedLeague,
  UnifiedMatch,
  UnifiedTeam,
} from '@/lib/types';
import { encodeEntityId, FEATURED_LEAGUES } from '@/lib/constants';
import type { FootballProvider } from './base';
import { fetchJson, ProviderError } from './http';

/**
 * football-data.org (v4) — primary provider.
 * Free plan: 10 req/min, major competitions. Auth via X-Auth-Token header.
 * A token bucket paces outgoing requests so bursts stay under the limit.
 */

const BASE = 'https://api.football-data.org/v4';
const TOKEN = process.env.FOOTBALL_DATA_API_TOKEN;
const RATE_PER_MIN = 10;

// ---- token bucket (module singleton) ----
// capacity 8 keeps 2 requests of headroom under the 10/min free-plan budget
let tokens = 8;
const BURST = 8;
let lastRefill = Date.now();
let queue: Promise<void> = Promise.resolve();

function acquireToken(): Promise<void> {
  const task = queue.then(async () => {
    const now = Date.now();
    const refill = ((now - lastRefill) / 60000) * RATE_PER_MIN;
    tokens = Math.min(BURST, tokens + Math.max(0, refill));
    lastRefill = now;
    if (tokens < 1) {
      const wait = Math.ceil(((1 - tokens) / RATE_PER_MIN) * 60000);
      await new Promise((r) => setTimeout(r, wait));
      tokens = 0;
      lastRefill = Date.now();
    } else {
      tokens -= 1;
    }
  });
  queue = task.catch(() => undefined);
  return task;
}

// ---- response typings (subset of v4 payloads we consume) ----
interface FdArea { name?: string }
interface FdCompetition { id: number; name: string; code?: string; emblem?: string; area?: FdArea }
interface FdTeam { id: number; name: string; shortName?: string; tla?: string; crest?: string }
interface FdGoal {
  minute: number; injuryTime?: number | null; type?: string;
  scorer: { id?: number; name?: string };
  assist?: { id?: number; name?: string } | null;
  team: { id?: number; name?: string };
}
interface FdBooking { minute: number; team: { id?: number }; player: { name?: string }; card: string }
interface FdSub { minute: number; team: { id?: number }; playerOut: { name?: string }; playerIn: { name?: string } }
interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  minute?: string | number | null;
  matchday?: number | null;
  competition: FdCompetition;
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  venue?: string | null;
  referees?: { name?: string; role?: string }[];
  score: {
    winner?: string | null;
    fullTime?: { home: number | null; away: number | null };
    halfTime?: { home: number | null; away: number | null };
    penalties?: { home: number | null; away: number | null } | null;
  };
  goals?: FdGoal[];
  bookings?: FdBooking[];
  substitutions?: FdSub[];
}

function mapStatus(s: string): MatchStatus {
  switch (s) {
    case 'IN_PLAY': return 'live';
    case 'PAUSED': return 'halftime';
    case 'FINISHED': return 'finished';
    case 'POSTPONED': return 'postponed';
    case 'CANCELLED': case 'SUSPENDED': return 'cancelled';
    default: return 'scheduled'; // SCHEDULED, TIMED
  }
}

function teamRef(t: FdTeam) {
  return {
    id: encodeEntityId('fd', t.id),
    name: t.shortName || t.name,
    shortName: t.shortName ?? null,
    crest: t.crest ?? null,
  };
}

function mapEvents(m: FdMatch): MatchEvent[] {
  const events: MatchEvent[] = [];
  for (const g of m.goals ?? []) {
    const type = g.type === 'OwnGoal' ? 'own_goal' : g.type === 'Penalty' ? 'penalty_goal' : 'goal';
    events.push({
      type,
      minute: g.minute ?? null,
      extraMinute: g.injuryTime ?? null,
      teamId: g.team?.id != null ? encodeEntityId('fd', g.team.id) : null,
      player: g.scorer?.name ?? null,
      assist: g.assist?.name ?? null,
      playerOut: null,
      playerIn: null,
    });
  }
  for (const b of m.bookings ?? []) {
    events.push({
      type: b.card === 'RED_CARD' ? 'red' : b.card === 'YELLOW_RED_CARD' ? 'yellow_red' : 'yellow',
      minute: b.minute ?? null,
      extraMinute: null,
      teamId: b.team?.id != null ? encodeEntityId('fd', b.team.id) : null,
      player: b.player?.name ?? null,
      assist: null,
      playerOut: null,
      playerIn: null,
    });
  }
  for (const s of m.substitutions ?? []) {
    events.push({
      type: 'sub',
      minute: s.minute ?? null,
      extraMinute: null,
      teamId: s.team?.id != null ? encodeEntityId('fd', s.team.id) : null,
      player: null,
      assist: null,
      playerOut: s.playerOut?.name ?? null,
      playerIn: s.playerIn?.name ?? null,
    });
  }
  return events.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
}

function mapMatch(m: FdMatch, includeEvents = false): UnifiedMatch {
  const ft = m.score?.fullTime ?? { home: null, away: null };
  const ht = m.score?.halfTime ?? { home: null, away: null };
  const pens = m.score?.penalties ?? null;
  let minute: number | null = null;
  if (typeof m.minute === 'number') minute = m.minute;
  else if (typeof m.minute === 'string') {
    const n = parseInt(m.minute, 10);
    if (!Number.isNaN(n)) minute = n;
  }
  return {
    id: encodeEntityId('fd', m.id),
    provider: 'fd',
    providerId: String(m.id),
    utcDate: m.utcDate,
    status: mapStatus(m.status),
    minute,
    home: teamRef(m.homeTeam),
    away: teamRef(m.awayTeam),
    score: {
      home: ft.home, away: ft.away,
      htHome: ht.home, htAway: ht.away,
      pensHome: pens?.home ?? null, pensAway: pens?.away ?? null,
    },
    league: {
      id: encodeEntityId('fd', m.competition.code ?? m.competition.id),
      code: m.competition.code ?? null,
      name: m.competition.name,
      emblem: m.competition.emblem ?? null,
      country: m.competition.area?.name ?? null,
    },
    matchday: m.matchday ?? null,
    venue: m.venue ?? null,
    referee: m.referees?.find((r) => r.role === 'REFEREE')?.name ?? m.referees?.[0]?.name ?? null,
    events: includeEvents ? mapEvents(m) : [],
    lastUpdated: new Date().toISOString(),
  };
}

async function api<T>(path: string): Promise<T> {
  if (!TOKEN) throw new ProviderError('football-data token missing', 'auth');
  await acquireToken();
  return fetchJson<T>(`${BASE}${path}`, { headers: { 'X-Auth-Token': TOKEN } });
}

export const footballDataProvider: FootballProvider = {
  id: 'fd',
  name: 'football-data.org',
  enabled: () => Boolean(TOKEN),

  async getLiveMatches(): Promise<UnifiedMatch[]> {
    const codes = FEATURED_LEAGUES.map((l) => l.fdCode).join(',');
    const res = await api<{ matches: FdMatch[] }>(`/matches?status=LIVE&competitions=${codes}`);
    return (res.matches ?? []).map((m) => mapMatch(m, true));
  },

  async getMatchesByDate(date: string): Promise<UnifiedMatch[]> {
    return this.getMatchesByRange(date, date);
  },

  /** Range query — football-data's dateTo is inclusive up to midnight (T00:00Z)
   * only, so the caller-visible `to` becomes `to + 1 day` under the hood. */
  async getMatchesByRange(from: string, to: string): Promise<UnifiedMatch[]> {
    const codes = FEATURED_LEAGUES.map((l) => l.fdCode).join(',');
    const end = new Date(`${to}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    const dateTo = end.toISOString().slice(0, 10);
    const res = await api<{ matches: FdMatch[] }>(
      `/matches?dateFrom=${from}&dateTo=${dateTo}&competitions=${codes}`,
    );
    return (res.matches ?? []).map((m) => mapMatch(m));
  },

  async getMatch(parts: string[]): Promise<UnifiedMatch | null> {
    const [id] = parts;
    if (!id) throw new ProviderError('missing match id', 'http', 400);
    const res = await api<FdMatch>(`/matches/${encodeURIComponent(id)}`);
    if (!res || !res.id) return null;
    return mapMatch(res, true);
  },

  async getLeagues(): Promise<UnifiedLeague[]> {
    interface FdCompetitionFull extends FdCompetition {
      currentSeason?: { startDate?: string; endDate?: string; currentMatchday?: number } | null;
    }
    const res = await api<{ competitions: FdCompetitionFull[] }>('/competitions');
    const allowed = new Set(FEATURED_LEAGUES.map((l) => l.fdCode));
    return (res.competitions ?? [])
      .filter((c) => c.code && allowed.has(c.code))
      .map((c) => ({
        id: encodeEntityId('fd', c.code!),
        code: c.code ?? null,
        name: c.name,
        emblem: c.emblem ?? null,
        country: c.area?.name ?? null,
        currentSeason: c.currentSeason
          ? {
              startDate: c.currentSeason.startDate ?? null,
              endDate: c.currentSeason.endDate ?? null,
              currentMatchday: c.currentSeason.currentMatchday ?? null,
            }
          : null,
      }));
  },

  async getLeagueMatches(code: string): Promise<UnifiedMatch[]> {
    const res = await api<{ matches: FdMatch[] }>(`/competitions/${encodeURIComponent(code)}/matches`);
    return (res.matches ?? []).map((m) => mapMatch(m));
  },

  async getStandings(code: string): Promise<StandingRow[]> {
    interface FdRow {
      position: number; team: FdTeam; playedGames: number; won: number; draw: number; lost: number;
      goalsFor: number; goalsAgainst: number; goalDifference: number; points: number; form?: string | null;
    }
    interface FdGroup { stage?: string; type?: string; group?: string | null; table: FdRow[] }
    const res = await api<{ standings: FdGroup[] }>(`/competitions/${encodeURIComponent(code)}/standings`);
    const rows: StandingRow[] = [];
    const groups = res.standings ?? [];
    const relegationCut = 3; // highlight last N as relegation-ish zone
    const main = groups.filter((g) => g.type === 'TOTAL');
    if (groups.length === 1 && main.length === 1) {
      const table = main[0].table;
      table.forEach((r, i) => {
        rows.push({
          position: r.position, team: teamRef(r.team),
          played: r.playedGames, won: r.won, draw: r.draw, lost: r.lost,
          goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst,
          goalDifference: r.goalDifference, points: r.points,
          form: r.form ?? null,
          zone: i < 4 ? 'champions' : i < 6 ? 'europe' : i >= table.length - relegationCut ? 'relegation' : null,
          group: main[0].group ?? null,
        });
      });
    } else {
      // multi-group competitions (e.g. UEFA CL league phase)
      for (const g of main.length ? main : groups) {
        g.table.forEach((r) => {
          rows.push({
            position: r.position, team: teamRef(r.team),
            played: r.playedGames, won: r.won, draw: r.draw, lost: r.lost,
            goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst,
            goalDifference: r.goalDifference, points: r.points,
            form: r.form ?? null, zone: null, group: g.group ?? g.stage ?? null,
          });
        });
      }
    }
    return rows;
  },

  async getScorers(code: string): Promise<Scorer[]> {
    interface FdScorer {
      player: { id?: number; name?: string; nationality?: string; dateOfBirth?: string; position?: string };
      team: FdTeam; goals: number; assists?: number | null; penalties?: number | null; playedMatches?: number;
    }
    const res = await api<{ scorers: FdScorer[] }>(`/competitions/${encodeURIComponent(code)}/scorers?limit=25`);
    return (res.scorers ?? []).map((s, i) => ({
      rank: i + 1,
      playerId: s.player?.id != null ? String(s.player.id) : null,
      name: s.player?.name ?? '—',
      team: teamRef(s.team),
      goals: s.goals ?? 0,
      assists: s.assists ?? null,
      penalties: s.penalties ?? null,
      played: s.playedMatches ?? null,
    }));
  },

  async getTeams(code: string): Promise<UnifiedTeam[]> {
    interface FdTeamFull extends FdTeam {
      area?: FdArea; venue?: string; founded?: number; website?: string;
    }
    const res = await api<{ teams: FdTeamFull[] }>(`/competitions/${encodeURIComponent(code)}/teams`);
    return (res.teams ?? []).map((t) => ({
      id: encodeEntityId('fd', t.id),
      provider: 'fd',
      providerId: String(t.id),
      name: t.name,
      shortName: t.shortName ?? null,
      crest: t.crest ?? null,
      country: t.area?.name ?? null,
      founded: t.founded ?? null,
      venue: t.venue ?? null,
      website: t.website ?? null,
      coach: null,
      squad: [],
      leagueCode: code,
    }));
  },

  async getTeam(parts: string[]): Promise<UnifiedTeam | null> {
    const [id] = parts;
    if (!id) throw new ProviderError('missing team id', 'http', 400);
    interface FdPerson { id?: number; name?: string; position?: string; nationality?: string; dateOfBirth?: string; shirtNumber?: number | null }
    interface FdTeamDetail extends FdTeam {
      area?: FdArea; venue?: string; founded?: number; website?: string;
      coach?: { name?: string } | null;
      squad?: FdPerson[];
      runningCompetitions?: { code?: string }[];
    }
    const t = await api<FdTeamDetail>(`/teams/${encodeURIComponent(id)}`);
    if (!t || !t.id) return null;
    const squad: SquadPlayer[] = (t.squad ?? []).map((p) => ({
      id: p.id != null ? String(p.id) : null,
      name: p.name ?? '—',
      position: p.position ?? null,
      nationality: p.nationality ?? null,
      dateOfBirth: p.dateOfBirth ?? null,
      shirtNumber: p.shirtNumber ?? null,
    }));
    return {
      id: encodeEntityId('fd', t.id),
      provider: 'fd',
      providerId: String(t.id),
      name: t.name,
      shortName: t.shortName ?? null,
      crest: t.crest ?? null,
      country: t.area?.name ?? null,
      founded: t.founded ?? null,
      venue: t.venue ?? null,
      website: t.website ?? null,
      coach: t.coach?.name ?? null,
      squad,
      leagueCode: t.runningCompetitions?.find((c) => c.code)?.code ?? null,
    };
  },

  async getTeamMatches(parts: string[], kind: 'recent' | 'upcoming'): Promise<UnifiedMatch[]> {
    const [id] = parts;
    if (!id) throw new ProviderError('missing team id', 'http', 400);
    const status = kind === 'recent' ? 'FINISHED' : 'SCHEDULED';
    const res = await api<{ matches: FdMatch[] }>(
      `/teams/${encodeURIComponent(id)}/matches?status=${status}&limit=15`,
    );
    const matches = (res.matches ?? []).map((m) => mapMatch(m));
    // finished → newest first; scheduled → soonest first
    return kind === 'recent' ? matches.reverse() : matches;
  },

  async searchTeams(): Promise<never> {
    // football-data.org has no free-text team search; fallback providers cover it.
    throw new ProviderError('searchTeams not supported', 'unsupported');
  },
};

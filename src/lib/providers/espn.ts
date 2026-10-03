import type { MatchStatus, UnifiedMatch } from '@/lib/types';
import { encodeEntityId, featuredByEspnSlug, FEATURED_LEAGUES } from '@/lib/constants';
import type { FootballProvider } from './base';
import { fetchJson, ProviderError } from './http';
import { mapTournamentStandings } from '@/lib/pure/tournament';
import type { EspnStandingsResponse, TournamentStandingRow } from '@/lib/pure/tournament';

/**
 * ESPN public scoreboard — no key required. Used as the live-scores and
 * fixtures fallback when the keyed primary is down or rate-limited.
 */

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ENABLED = (process.env.ESPN_PROVIDER_ENABLED ?? 'true') !== 'false';

interface EspnAthlete { displayName?: string }
interface EspnDetail {
  type?: { id?: string; text?: string };
  clock?: { displayValue?: string };
  athletes?: EspnAthlete[];
  team?: { id?: string };
  scoringPlay?: boolean;
  penaltyKick?: boolean;
  ownGoal?: boolean;
  redCard?: boolean;
  yellowCard?: boolean;
}
interface EspnCompetitor {
  homeAway?: string;
  score?: string | { value?: number };
  team?: { id?: string; displayName?: string; shortDisplayName?: string; logo?: string };
  linescores?: { value?: number }[];
}
interface EspnEvent {
  id: string;
  date: string;
  name?: string;
  season?: { type?: number; slug?: string };
  status?: {
    type?: { state?: string; detail?: string; shortDetail?: string; name?: string };
    displayClock?: string;
    period?: number;
  };
  competitions?: {
    id?: string;
    venue?: { fullName?: string };
    competitors?: EspnCompetitor[];
    details?: EspnDetail[];
    /** present on cup/tournament group-stage matches only, e.g. {name: "Group A"} */
    group?: { name?: string };
  }[];
  league?: { id?: string; name?: string; abbreviation?: string; slug?: string };
}

function mapStatus(e: EspnEvent): { status: MatchStatus; minute: number | null } {
  const state = e.status?.type?.state;
  const detail = e.status?.type?.detail ?? e.status?.type?.shortDetail ?? '';
  const clock = e.status?.displayClock ?? '';
  let minute: number | null = null;
  const m = /(\d+)/.exec(clock);
  if (m) minute = parseInt(m[1], 10);

  if (state === 'in') {
    if (/halftime/i.test(detail) || /halftime/i.test(clock)) return { status: 'halftime', minute };
    return { status: 'live', minute };
  }
  if (state === 'post') {
    if (/postponed/i.test(detail)) return { status: 'postponed', minute: null };
    if (/cancel/i.test(detail)) return { status: 'cancelled', minute: null };
    return { status: 'finished', minute };
  }
  if (/postponed/i.test(detail)) return { status: 'postponed', minute: null };
  return { status: 'scheduled', minute: null };
}

function parseScore(s: EspnCompetitor['score']): number | null {
  if (s == null) return null;
  if (typeof s === 'string') {
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? null : n;
  }
  return typeof s.value === 'number' ? s.value : null;
}

function mapEvent(e: EspnEvent, slug: string, live: boolean): UnifiedMatch | null {
  const comp = e.competitions?.[0];
  if (!comp) return null;
  const homeC = comp.competitors?.find((c) => c.homeAway === 'home');
  const awayC = comp.competitors?.find((c) => c.homeAway === 'away');
  if (!homeC?.team || !awayC?.team) return null;

  const featured = featuredByEspnSlug(slug);
  const { status, minute } = mapStatus(e);
  const hasScore = status !== 'scheduled';

  const events: UnifiedMatch['events'] = [];
  if (live) {
    for (const d of comp.details ?? []) {
      const clock = d.clock?.displayValue ?? '';
      const mi = /(\d+)/.exec(clock);
      const minute = mi ? parseInt(mi[1], 10) : null;
      const player = d.athletes?.[0]?.displayName ?? null;
      if (d.type?.text === 'Penalty - Scored' || (d.scoringPlay && d.penaltyKick)) {
        events.push({ type: 'penalty_goal', minute, extraMinute: null, teamId: null, player, assist: null, playerOut: null, playerIn: null });
      } else if (d.scoringPlay || /goal/i.test(d.type?.text ?? '')) {
        events.push({ type: d.ownGoal ? 'own_goal' : 'goal', minute, extraMinute: null, teamId: null, player, assist: null, playerOut: null, playerIn: null });
      } else if (d.redCard) {
        events.push({ type: 'red', minute, extraMinute: null, teamId: null, player, assist: null, playerOut: null, playerIn: null });
      } else if (d.yellowCard) {
        events.push({ type: 'yellow', minute, extraMinute: null, teamId: null, player, assist: null, playerOut: null, playerIn: null });
      } else if (/substitution/i.test(d.type?.text ?? '')) {
        events.push({ type: 'sub', minute, extraMinute: null, teamId: null, player: null, assist: null, playerOut: null, playerIn: player });
      }
    }
    events.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  }

  return {
    id: encodeEntityId('espn', slug, e.id),
    provider: 'espn',
    providerId: e.id,
    utcDate: e.date,
    status,
    minute,
    home: {
      id: encodeEntityId('espn', homeC.team.id ?? homeC.team.displayName ?? 'home'),
      name: homeC.team.shortDisplayName || homeC.team.displayName || '',
      shortName: homeC.team.shortDisplayName ?? null,
      crest: homeC.team.logo ?? null,
    },
    away: {
      id: encodeEntityId('espn', awayC.team.id ?? awayC.team.displayName ?? 'away'),
      name: awayC.team.shortDisplayName || awayC.team.displayName || '',
      shortName: awayC.team.shortDisplayName ?? null,
      crest: awayC.team.logo ?? null,
    },
    score: hasScore ? { home: parseScore(homeC.score), away: parseScore(awayC.score) } : { home: null, away: null },
    league: {
      id: encodeEntityId('fd', featured?.fdCode ?? slug),
      code: featured?.fdCode ?? null,
      name: featured?.nameEn ?? e.league?.name ?? slug,
      emblem: featured?.emblem ?? null,
      country: featured?.country ?? null,
    },
    matchday: null,
    venue: comp.venue?.fullName ?? null,
    referee: null,
    events,
    lastUpdated: new Date().toISOString(),
  };
}

async function scoreboard(slug: string, date?: string): Promise<{ events?: EspnEvent[] }> {
  const dateParam = date ? `?dates=${date.replaceAll('-', '')}` : '';
  return fetchJson(`${BASE}/${slug}/scoreboard${dateParam}`);
}

const settled = <T>(p: PromiseSettledResult<T>): T[] =>
  p.status === 'fulfilled' ? [p.value] : [];

export const espnProvider: FootballProvider = {
  id: 'espn',
  name: 'ESPN',
  enabled: () => ENABLED,

  async getLiveMatches(): Promise<UnifiedMatch[]> {
    const results = await Promise.allSettled(FEATURED_LEAGUES.map((l) => scoreboard(l.espnSlug)));
    const matches: UnifiedMatch[] = [];
    for (const r of results) {
      for (const data of settled(r)) {
        for (const e of data.events ?? []) {
          const m = mapEvent(e, e.league?.slug ?? '', true);
          if (m && (m.status === 'live' || m.status === 'halftime')) matches.push(m);
        }
      }
    }
    return matches;
  },

  async getMatchesByDate(date: string): Promise<UnifiedMatch[]> {
    return this.getMatchesByRange(date, date);
  },

  /** ESPN has no true range endpoint — fan out per day per league.
   *  If EVERY request fails, throw so the fallback chain records a real
   *  provider outage instead of caching a fabricated "no matches" truth. */
  async getMatchesByRange(from: string, to: string): Promise<UnifiedMatch[]> {
    const days: string[] = [];
    for (let d = new Date(`${from}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      if (iso > to || days.length >= 14) break;
      days.push(iso);
    }
    const tasks = days.flatMap((day) =>
      FEATURED_LEAGUES.map((l) => scoreboard(l.espnSlug, day).then((d) => ({ slug: l.espnSlug, d }))),
    );
    const results = await Promise.allSettled(tasks);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    if (ok === 0) {
      throw new ProviderError(`espn scoreboard unreachable for ${from}..${to}`, 'network');
    }
    const matches: UnifiedMatch[] = [];
    const seen = new Set<string>();
    for (const r of results) {
      for (const { slug, d } of settled(r)) {
        for (const e of d.events ?? []) {
          const m = mapEvent(e, slug, false);
          if (m && !seen.has(m.id)) {
            seen.add(m.id);
            matches.push(m);
          }
        }
      }
    }
    return matches.sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  },

  async getMatch(parts: string[]): Promise<UnifiedMatch | null> {
    const [slug, eventId] = parts;
    if (!slug || !eventId) throw new ProviderError('missing espn id parts', 'http', 400);
    // scoreboard (today ±). ESPN summary endpoint returns odds-heavy payload;
    // scoreboard for the event's date is enough for status/score.
    const data = await fetchJson<{ events?: EspnEvent[] }>(
      `${BASE}/${slug}/scoreboard?event=${encodeURIComponent(eventId)}`,
    );
    const event = (data.events ?? []).find((e) => e.id === eventId);
    if (!event) return null;
    return mapEvent(event, slug, true);
  },

  async getLeagues() { throw new ProviderError('not supported', 'unsupported'); },
  async getLeagueMatches() { throw new ProviderError('not supported', 'unsupported'); },
  async getStandings() { throw new ProviderError('not supported', 'unsupported'); },
  async getScorers() { throw new ProviderError('not supported', 'unsupported'); },
  async getTeams() { throw new ProviderError('not supported', 'unsupported'); },
  async getTeam() { throw new ProviderError('not supported', 'unsupported'); },
  async getTeamMatches() { throw new ProviderError('not supported', 'unsupported'); },
  async searchTeams() { throw new ProviderError('not supported', 'unsupported'); },
};

// ----------------------------------------------------------- tournaments ----
// Cup/tournament support (World Cup, AFCON, ...): not part of the live
// waterfall above (no other free source covers group+knockout schema), used
// only by the dedicated tournament hub via src/lib/tournaments.ts.

export interface TournamentMatch extends UnifiedMatch {
  /** ESPN's own round slug, e.g. "group-stage", "semifinals" — verified live. */
  roundSlug: string | null;
  /** Group name when this match belongs to a group stage, e.g. "Group A". */
  groupName: string | null;
}

/**
 * The entire tournament schedule in ONE request — verified live against
 * `/apis/site/v2/sports/soccer/{slug}/scoreboard?dates={year}&limit=300` for
 * both the 2026 FIFA World Cup and the 2025 Africa Cup of Nations.
 */
export async function fetchTournamentSchedule(slug: string, year: number): Promise<TournamentMatch[]> {
  const data = await fetchJson<{ events?: EspnEvent[] }>(
    `${BASE}/${slug}/scoreboard?dates=${year}&limit=300`,
  );
  const out: TournamentMatch[] = [];
  for (const e of data.events ?? []) {
    const m = mapEvent(e, slug, false);
    if (!m) continue;
    out.push({
      ...m,
      roundSlug: e.season?.slug ?? null,
      groupName: e.competitions?.[0]?.group?.name ?? null,
    });
  }
  return out;
}

const STANDINGS_BASE = 'https://site.api.espn.com/apis/v2/sports/soccer';

/**
 * Group-stage standings — verified live against
 * `/apis/v2/sports/soccer/{slug}/standings?season={year}` for both the 2026
 * FIFA World Cup and the 2025 Africa Cup of Nations. Returns `[]` for
 * straight-knockout tournaments or seasons with no groups yet (never thrown
 * as an error — an empty group stage is a valid, real answer).
 */
export async function fetchTournamentStandings(slug: string, year: number): Promise<TournamentStandingRow[]> {
  const data = await fetchJson<EspnStandingsResponse>(`${STANDINGS_BASE}/${slug}/standings?season=${year}`);
  return mapTournamentStandings(data, (teamId) => encodeEntityId('espn', teamId));
}

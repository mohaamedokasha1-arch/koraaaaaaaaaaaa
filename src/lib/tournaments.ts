import 'server-only';
import type { DataResult, UnifiedMatch } from '@/lib/types';
import type { TournamentStandingRow } from '@/lib/pure/tournament';
import { roundSortKey } from '@/lib/pure/tournament';
import { CACHE_TTL, cache, getOrSet } from '@/lib/cache';
import { fetchTournamentSchedule, fetchTournamentStandings, type TournamentMatch } from '@/lib/providers/espn';

/**
 * Cup/tournament hub service (ESPN hidden API).
 *
 * A single-purpose source, same spirit as src/lib/historical.ts: it is
 * deliberately NOT part of the live waterfall (no other free source covers
 * group+knockout schema for these competitions), so it can never slow down
 * or shadow a working league provider. Only tournaments verified live below
 * are listed — an unlisted slug renders no page at all, never a fabricated
 * one. See src/lib/pure/tournament.ts for the verified response shapes.
 */

export interface TournamentConfig {
  /** ESPN slug, also used as the route param, e.g. "fifa.world". */
  slug: string;
  /** ESPN "season" query year for the standings/schedule endpoints. */
  season: number;
  nameAr: string;
  nameEn: string;
  countryAr: string;
  countryEn: string;
  logo: string | null;
}

export const TOURNAMENTS: TournamentConfig[] = [
  {
    slug: 'fifa.world',
    season: 2026,
    nameAr: 'كأس العالم 2026',
    nameEn: 'FIFA World Cup 2026',
    countryAr: 'دولي',
    countryEn: 'International',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/4.png',
  },
  {
    slug: 'caf.nations',
    season: 2025,
    nameAr: 'كأس الأمم الأفريقية 2025',
    nameEn: 'Africa Cup of Nations 2025',
    countryAr: 'أفريقيا',
    countryEn: 'Africa',
    logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/76.png',
  },
];

export function tournamentBySlug(slug: string): TournamentConfig | undefined {
  return TOURNAMENTS.find((t) => t.slug === slug);
}

/** Cup group tables never have the league relegation/Europe-zone concept. */
function toStandingRows(rows: TournamentStandingRow[]) {
  return rows.map((r) => ({
    position: r.position,
    team: { id: r.team.id, name: r.team.name, shortName: null, crest: r.team.crest },
    played: r.played,
    won: r.won,
    draw: r.draw,
    lost: r.lost,
    goalsFor: r.goalsFor,
    goalsAgainst: r.goalsAgainst,
    goalDifference: r.goalDifference,
    points: r.points,
    form: null,
    zone: null,
    group: r.group,
    note: r.note,
  }));
}

export async function getTournamentStandings(config: TournamentConfig): Promise<DataResult<ReturnType<typeof toStandingRows>>> {
  const cacheKey = `tournament:standings:${config.slug}:${config.season}`;
  try {
    const { value, stale } = await getOrSet(cacheKey, CACHE_TTL.STANDINGS, () =>
      fetchTournamentStandings(config.slug, config.season),
    );
    return { data: toStandingRows(value), source: 'espn', stale, fetchedAt: cache.get(cacheKey)?.fetchedAt ?? new Date().toISOString() };
  } catch {
    const stale = cache.getStale<TournamentStandingRow[]>(cacheKey);
    if (stale) return { data: toStandingRows(stale.value), source: 'espn', stale: true, fetchedAt: stale.fetchedAt };
    return { data: [], source: 'espn', stale: true, fetchedAt: new Date().toISOString() };
  }
}

export interface TournamentRound {
  slug: string | null;
  matches: UnifiedMatch[];
  /** Matches further split by group name when this round is the group stage. */
  groups: { name: string; matches: UnifiedMatch[] }[] | null;
}

function toRounds(matches: TournamentMatch[]): TournamentRound[] {
  const bySlug = new Map<string | null, TournamentMatch[]>();
  for (const m of matches) {
    const list = bySlug.get(m.roundSlug);
    if (list) list.push(m);
    else bySlug.set(m.roundSlug, [m]);
  }
  return Array.from(bySlug.entries())
    .sort(([a], [b]) => roundSortKey(a) - roundSortKey(b))
    .map(([slug, list]) => {
      const sorted = [...list].sort((a, b) => a.utcDate.localeCompare(b.utcDate));
      const hasGroups = sorted.some((m) => m.groupName);
      let groups: { name: string; matches: UnifiedMatch[] }[] | null = null;
      if (hasGroups) {
        const byGroup = new Map<string, UnifiedMatch[]>();
        for (const m of sorted) {
          const name = m.groupName ?? '—';
          const list2 = byGroup.get(name);
          if (list2) list2.push(m);
          else byGroup.set(name, [m]);
        }
        groups = Array.from(byGroup.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, ms]) => ({ name, matches: ms }));
      }
      return { slug, matches: sorted, groups };
    });
}

export async function getTournamentSchedule(config: TournamentConfig): Promise<DataResult<TournamentRound[]>> {
  const cacheKey = `tournament:schedule:${config.slug}:${config.season}`;
  try {
    const { value, stale } = await getOrSet(cacheKey, CACHE_TTL.LEAGUE_MATCHES, () =>
      fetchTournamentSchedule(config.slug, config.season),
    );
    return { data: toRounds(value), source: 'espn', stale, fetchedAt: cache.get(cacheKey)?.fetchedAt ?? new Date().toISOString() };
  } catch {
    const stale = cache.getStale<TournamentMatch[]>(cacheKey);
    if (stale) return { data: toRounds(stale.value), source: 'espn', stale: true, fetchedAt: stale.fetchedAt };
    return { data: [], source: 'espn', stale: true, fetchedAt: new Date().toISOString() };
  }
}

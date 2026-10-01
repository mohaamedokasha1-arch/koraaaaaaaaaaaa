import 'server-only';
import type { DataResult, UnifiedMatch } from '@/lib/types';
import { foldText } from '@/lib/pure/entity';
import { getHistoricalSeason, hasHistory, historySeasons } from '@/lib/historical';
import { leagueByCode } from '@/lib/constants';
import { cache } from '@/lib/cache';

/**
 * Head-to-head built exclusively from REAL stored matches.
 *
 * Sources of truth, in order:
 *   1. the in-memory match store (everything this instance has recently served),
 *   2. the openfootball completed seasons (CC0) for competitions it covers.
 *
 * Teams are matched by folded name across datasets, because a 2024 openfootball
 * fixture and a 2026 provider fixture identify the same club differently. Only
 * matches where BOTH sides match the requested pair are counted, and the page is
 * only created when enough real meetings exist — otherwise there is no page at
 * all (never a fabricated 0-0 archive).
 */

export interface H2HSummary {
  matches: UnifiedMatch[];
  total: number;
  teamAWins: number;
  teamBWins: number;
  draws: number;
  teamAGoals: number;
  teamBGoals: number;
  lastMeeting: string | null;
  /** Competitions the meetings came from, with counts. */
  competitions: { code: string | null; name: string; count: number }[];
}

export interface H2HPair {
  a: { name: string; slug: string };
  b: { name: string; slug: string };
  summary: H2HSummary;
  /** True when the meetings span more than the live window (archive used). */
  includesArchive: boolean;
}

const MIN_MEETINGS = 3;

function pairKey(a: string, b: string): string {
  return [foldText(a), foldText(b)].sort().join('::');
}

/** Matches cached for the current instance that involve both clubs. */
function cachedMeetings(nameA: string, nameB: string): UnifiedMatch[] {
  const foldedA = foldText(nameA);
  const foldedB = foldText(nameB);
  const out: UnifiedMatch[] = [];
  for (const key of cache.keysWithPrefix('matches:')) {
    const hit = cache.get<UnifiedMatch[]>(key);
    if (!hit) continue;
    for (const match of hit.value) {
      const home = foldText(match.home.name);
      const away = foldText(match.away.name);
      if (
        (matchesName(home, foldedA) && matchesName(away, foldedB)) ||
        (matchesName(home, foldedB) && matchesName(away, foldedA))
      ) {
        out.push(match);
      }
    }
  }
  return out;
}

function matchesName(candidate: string, target: string): boolean {
  if (!candidate || !target) return false;
  if (candidate === target) return true;
  const stripped = candidate.replace(/^(al|el|fc|sc|club)\s+/g, '').replace(/\s+(sc|fc|cf|club)$/g, '');
  const targetStripped = target.replace(/^(al|el|fc|sc|club)\s+/g, '').replace(/\s+(sc|fc|cf|club)$/g, '');
  return stripped === targetStripped || stripped.includes(targetStripped) || targetStripped.includes(stripped);
}

function summarise(matches: UnifiedMatch[], nameA: string): H2HSummary {
  const foldedA = foldText(nameA);
  let teamAWins = 0;
  let teamBWins = 0;
  let draws = 0;
  let teamAGoals = 0;
  let teamBGoals = 0;
  const competitions = new Map<string, { code: string | null; name: string; count: number }>();

  const finished = matches
    .filter((m) => m.status === 'finished' && m.score.home != null && m.score.away != null)
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate));

  for (const match of finished) {
    const homeIsA = matchesName(foldText(match.home.name), foldedA);
    const aGoals = homeIsA ? match.score.home ?? 0 : match.score.away ?? 0;
    const bGoals = homeIsA ? match.score.away ?? 0 : match.score.home ?? 0;
    teamAGoals += aGoals;
    teamBGoals += bGoals;
    if (aGoals > bGoals) teamAWins += 1;
    else if (bGoals > aGoals) teamBWins += 1;
    else draws += 1;

    const key = match.league.code ?? match.league.name;
    const existing = competitions.get(key);
    if (existing) existing.count += 1;
    else competitions.set(key, { code: match.league.code, name: match.league.name, count: 1 });
  }

  return {
    matches: finished.slice(0, 30),
    total: finished.length,
    teamAWins,
    teamBWins,
    draws,
    teamAGoals,
    teamBGoals,
    lastMeeting: finished[0]?.utcDate ?? null,
    competitions: [...competitions.values()].sort((a, b) => b.count - a.count),
  };
}

/**
 * Build the H2H pair for two clubs. Returns null when fewer than three real
 * meetings exist, so no thin page can be created for a pair that never played.
 */
export async function getHeadToHead(
  nameA: string,
  slugA: string,
  nameB: string,
  slugB: string,
  options: { leagueCodes?: string[] } = {},
): Promise<DataResult<H2HPair | null>> {
  const collected = new Map<string, UnifiedMatch>();
  for (const match of cachedMeetings(nameA, nameB)) collected.set(match.id, match);

  let includesArchive = false;
  const codes = options.leagueCodes ?? [];
  for (const code of codes) {
    if (!hasHistory(code)) continue;
    for (const season of historySeasons(code).slice(0, 6)) {
      const result = await getHistoricalSeason(code, season);
      if (!result) continue;
      for (const match of result.data) {
        const home = foldText(match.home.name);
        const away = foldText(match.away.name);
        if (
          (matchesName(home, foldText(nameA)) && matchesName(away, foldText(nameB))) ||
          (matchesName(home, foldText(nameB)) && matchesName(away, foldText(nameA)))
        ) {
          collected.set(match.id, match);
          includesArchive = true;
        }
      }
    }
  }

  const summary = summarise([...collected.values()], nameA);
  if (summary.total < MIN_MEETINGS) {
    return { data: null, source: includesArchive ? 'mixed' : 'cache', stale: false, fetchedAt: new Date().toISOString() };
  }

  return {
    data: {
      a: { name: nameA, slug: slugA },
      b: { name: nameB, slug: slugB },
      summary,
      includesArchive,
    },
    source: includesArchive ? 'mixed' : 'cache',
    stale: false,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Opponents this club has real stored meetings against.
 *
 * Used by team pages to link ONLY to H2H pages that will actually render:
 * a pair below MIN_MEETINGS has no page, so linking there would create a 404.
 * Because the store is per-instance the list is naturally small right after a
 * cold start — that is honest, and it grows as the instance serves matches.
 */
export function h2hCandidatesFor(teamName: string, limit = 6): { name: string; count: number }[] {
  const folded = foldText(teamName);
  const counts = new Map<string, { name: string; count: number }>();

  for (const key of cache.keysWithPrefix('matches:')) {
    const hit = cache.get<UnifiedMatch[]>(key);
    if (!hit) continue;
    for (const match of hit.value) {
      if (match.status !== 'finished') continue;
      const home = foldText(match.home.name);
      const away = foldText(match.away.name);
      const other = matchesName(home, folded) ? match.away : matchesName(away, folded) ? match.home : null;
      if (!other) continue;
      const otherKey = foldText(other.name);
      const existing = counts.get(otherKey);
      if (existing) existing.count += 1;
      else counts.set(otherKey, { name: other.name, count: 1 });
    }
  }

  return [...counts.values()]
    .filter((entry) => entry.count >= MIN_MEETINGS)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Competitions worth checking for a pair (only ones this app can serve). */
export function archiveLeagueCodesFor(leagueCode: string | null): string[] {
  if (leagueCode && hasHistory(leagueCode)) return [leagueCode];
  return ['PL', 'PD', 'SA', 'BL1', 'FL1', 'EGY'].filter((code) => leagueByCode(code) && hasHistory(code));
}

/** Cheap guard for rendering H2H links: does this pair have a renderable page? */
export function hasEnoughMeetings(nameA: string, nameB: string): boolean {
  return cachedMeetings(nameA, nameB).length >= MIN_MEETINGS;
}

export { pairKey, MIN_MEETINGS };

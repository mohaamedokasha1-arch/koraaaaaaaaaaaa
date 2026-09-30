import 'server-only';
import type { DataResult, UnifiedMatch } from '@/lib/types';
import { CACHE_TTL, cache } from '@/lib/cache';
import {
  fetchHistoricalSeason,
  openFootballEnabled,
  OPENFOOTBALL_ATTRIBUTION,
  type HistoricalSource,
} from '@/lib/providers/openfootball';

/**
 * Historical-season service (openfootball, CC0).
 *
 * This is a single-purpose dataset source: it answers "what did season X look
 * like for league Y" and nothing else. It is deliberately NOT part of the live
 * waterfall, so it can never slow down or shadow a working live provider.
 *
 * Only leagues whose dataset existence was verified are listed; an unlisted
 * league renders no history tab at all (no empty pages, no fabricated data).
 */

interface LeagueHistory {
  source: HistoricalSource;
  /** Seasons verified to exist in the dataset, newest first. */
  seasons: string[];
}

const FOOTBALL_JSON_SEASONS = (): string[] => {
  // football.json ships 2010-11 → the running season; the running folder is
  // created during the summer break, so the current calendar season may be one
  // folder ahead of what exists yet. We only claim folders we have verified.
  const seasons: string[] = [];
  for (let start = 2025; start >= 2010; start -= 1) {
    seasons.push(`${start}-${String((start + 1) % 100).padStart(2, '0')}`);
  }
  return seasons;
};

const HISTORY: Record<string, LeagueHistory> = {
  PL: {
    source: {
      file: 'en.1',
      datasetUrl: 'https://github.com/openfootball/football.json',
    },
    seasons: FOOTBALL_JSON_SEASONS(),
  },
  ELC: {
    source: { file: 'en.2', datasetUrl: 'https://github.com/openfootball/football.json' },
    seasons: FOOTBALL_JSON_SEASONS(),
  },
  PD: {
    source: { file: 'es.1', datasetUrl: 'https://github.com/openfootball/football.json' },
    seasons: FOOTBALL_JSON_SEASONS(),
  },
  SA: {
    source: { file: 'it.1', datasetUrl: 'https://github.com/openfootball/football.json' },
    seasons: FOOTBALL_JSON_SEASONS(),
  },
  BL1: {
    source: { file: 'de.1', datasetUrl: 'https://github.com/openfootball/football.json' },
    seasons: FOOTBALL_JSON_SEASONS(),
  },
  FL1: {
    source: { file: 'fr.1', datasetUrl: 'https://github.com/openfootball/football.json' },
    seasons: FOOTBALL_JSON_SEASONS(),
  },
  DED: {
    source: { file: 'nl.1', datasetUrl: 'https://github.com/openfootball/football.json' },
    seasons: FOOTBALL_JSON_SEASONS(),
  },
  PPL: {
    source: { file: 'pt.1', datasetUrl: 'https://github.com/openfootball/football.json' },
    seasons: FOOTBALL_JSON_SEASONS(),
  },
  /**
   * Egyptian Premier League — the free live providers have no historical
   * archive for it; this public-domain dataset publishes two complete seasons.
   */
  EGY: {
    source: {
      worldPath: 'africa/egypt',
      worldSuffix: 'eg1',
      datasetUrl: 'https://github.com/openfootball/world/tree/master/africa/egypt',
    },
    seasons: ['2024-25', '2023-24'],
  },
};

export const HISTORY_ATTRIBUTION = OPENFOOTBALL_ATTRIBUTION;

export function hasHistory(code: string): boolean {
  return Boolean(HISTORY[code]) && openFootballEnabled();
}

export function historySeasons(code: string): string[] {
  const entry = HISTORY[code];
  if (!entry || !openFootballEnabled()) return [];
  return entry.seasons;
}

export function isKnownSeason(code: string, season: string): boolean {
  return historySeasons(code).includes(season);
}

/** Historical seasons are immutable → long TTL, and the cache is the only path. */
export async function getHistoricalSeason(
  code: string,
  season: string,
): Promise<DataResult<UnifiedMatch[]> | null> {
  const entry = HISTORY[code];
  if (!entry || !openFootballEnabled()) return null;

  const cacheKey = `history:${code}:${season}`;
  const cached = cache.get<UnifiedMatch[]>(cacheKey);
  if (cached) {
    return { data: cached.value, source: 'ofb', stale: cached.stale, fetchedAt: cached.fetchedAt };
  }

  try {
    const data = await fetchHistoricalSeason(entry.source, code, season);
    if (data.length === 0) return { data: [], source: 'ofb', stale: false, fetchedAt: new Date().toISOString() };
    const fetchedAt = cache.set(cacheKey, data, CACHE_TTL.HISTORY);
    return { data, source: 'ofb', stale: false, fetchedAt };
  } catch {
    const stale = cache.getStale<UnifiedMatch[]>(cacheKey);
    if (stale) return { data: stale.value, source: 'ofb', stale: true, fetchedAt: stale.fetchedAt };
    return null;
  }
}

/** Group a season into matchday buckets (newest matchday first). */
export function groupByMatchday(matches: UnifiedMatch[]): { matchday: number | null; matches: UnifiedMatch[] }[] {
  const buckets = new Map<number | null, UnifiedMatch[]>();
  for (const m of matches) {
    const list = buckets.get(m.matchday);
    if (list) list.push(m);
    else buckets.set(m.matchday, [m]);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => (b[0] ?? 0) - (a[0] ?? 0))
    .map(([matchday, list]) => ({
      matchday,
      matches: list.sort((a, b) => a.utcDate.localeCompare(b.utcDate)),
    }));
}

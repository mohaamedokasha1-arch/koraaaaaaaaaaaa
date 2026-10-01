import 'server-only';
import type {
  DataResult,
  LeagueSearchHit,
  NewsEntry,
  NewsStory,
  StandingRow,
  TeamSearchHit,
  UnifiedMatch,
  UnifiedTeam,
} from '@/lib/types';
import { CACHE_TTL, cache } from '@/lib/cache';
import { normalizeText, expandQuery, matchesQuery } from '@/lib/normalize';
import { foldText, scoreName } from '@/lib/pure/entity';
import { ALL_LEAGUES } from '@/lib/constants';
import { withFallback } from '@/lib/providers/registry';
import type { FootballProvider } from '@/lib/providers/base';
import { ambiguityOptions, searchEntities } from '@/lib/entities';
import { getNewsBundle, newsEnabled } from '@/lib/news';

/**
 * Entity-aware, unified search.
 *
 * "الأهلي", "Al Ahly", "Ahly" and "الأهلى" all resolve to the same entity, and
 * a query returns everything the platform knows about it: the entity itself,
 * its matches (from what this instance already holds — search never triggers a
 * provider fan-out), players seen in cached squads, and linked news.
 *
 * Ambiguity is a feature, not an error: when two clubs genuinely share a name
 * (Al Ahly Egypt / Al Ahly Saudi) the answer carries both as options instead of
 * silently picking one.
 */

export interface SearchEntityOption {
  id: string;
  slug: string;
  kind: string;
  name: string;
  nameAr: string | null;
  country: string | null;
  crest: string | null;
  score: number;
}

export interface SearchPlayerHit {
  id: string;
  name: string;
  team: string | null;
  teamId: string | null;
  detail: string | null;
}

export interface SearchMatchHit {
  id: string;
  utcDate: string;
  status: string;
  home: string;
  away: string;
  score: string | null;
  league: string | null;
  leagueCode: string | null;
}

export interface UnifiedSearchResult {
  query: string;
  normalized: string;
  entities: SearchEntityOption[];
  teams: (TeamSearchHit & { slug: string | null; entityId: string })[];
  leagues: (LeagueSearchHit & { slug: string | null; entityId: string })[];
  players: SearchPlayerHit[];
  matches: SearchMatchHit[];
  news: NewsEntry[];
  stories: NewsStory[];
  disambiguation: { name: string; options: SearchEntityOption[] } | null;
  /** Query expansions that were actually tried against providers. */
  expansions: string[];
}

function scoreText(text: string, query: string): number {
  const haystack = normalizeText(text);
  const needle = normalizeText(query);
  if (!needle || !haystack) return 0;
  if (haystack === needle) return 1;
  if (haystack.startsWith(needle)) return 0.85;
  if (haystack.includes(needle)) return 0.7;
  return 0;
}

/** Provider team search (cached, alias-expanded, relevance filtered). */
export async function searchProviderTeams(query: string): Promise<{ teams: UnifiedTeam[]; source: string; expansions: string[] }> {
  const normalized = normalizeText(query);
  const cacheKey = `search:teams:${normalized}`;
  const cached = cache.get<{ teams: UnifiedTeam[]; source: string; expansions: string[] }>(cacheKey);
  if (cached && !cached.stale) return cached.value;

  const expansions = expandQuery(query);
  const { data, source } = await withFallback('searchTeams', async (provider: FootballProvider) => {
    const settled = await Promise.allSettled(
      expansions.slice(0, 3).map((qq) => provider.searchTeams(qq)),
    );
    const seen = new Set<string>();
    const collected: UnifiedTeam[] = [];
    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      for (const team of result.value) {
        if (seen.has(team.id)) continue;
        seen.add(team.id);
        collected.push(team);
      }
    }
    if (collected.length === 0 && settled.every((r) => r.status === 'rejected')) {
      throw new Error('team search failed for every expansion');
    }
    const relevant = collected.filter((team) => matchesQuery(team.name, query));
    return (relevant.length > 0 ? relevant : collected).slice(0, 12);
  });

  const value = { teams: data, source, expansions };
  cache.set(cacheKey, value, CACHE_TTL.SEARCH);
  return value;
}

function matchLabel(match: UnifiedMatch): string | null {
  if (match.score.home == null || match.score.away == null) return null;
  return `${match.score.home} - ${match.score.away}`;
}

/** Matches already held in this instance whose teams match the query. */
function searchCachedMatches(query: string, limit = 8): SearchMatchHit[] {
  const needle = foldText(query);
  if (needle.length < 3) return [];
  const seen = new Map<string, SearchMatchHit>();
  const keys = [
    ...cache.keysWithPrefix('matches:'),
    ...cache.keysWithPrefix('matchesRange:'),
    'live:all',
    ...cache.keysWithPrefix('teamMatches:'),
    ...cache.keysWithPrefix('leagueMatches:'),
  ];
  for (const key of keys) {
    const hit = cache.get<UnifiedMatch[]>(key);
    if (!hit) continue;
    for (const match of hit.value) {
      if (seen.has(match.id)) continue;
      if (
        foldText(match.home.name).includes(needle) ||
        foldText(match.away.name).includes(needle)
      ) {
        seen.set(match.id, {
          id: match.id,
          utcDate: match.utcDate,
          status: match.status,
          home: match.home.name,
          away: match.away.name,
          score: matchLabel(match),
          league: match.league.name,
          leagueCode: match.league.code,
        });
      }
      if (seen.size >= limit) break;
    }
    if (seen.size >= limit) break;
  }
  return [...seen.values()].sort((a, b) => b.utcDate.localeCompare(a.utcDate));
}

/** Players seen in cached squads / scorer tables (no extra provider call). */
function searchCachedPlayers(query: string, limit = 6): SearchPlayerHit[] {
  const hits: SearchPlayerHit[] = [];
  const seen = new Set<string>();
  for (const key of cache.keysWithPrefix('team:')) {
    const hit = cache.get<UnifiedTeam>(key);
    if (!hit) continue;
    for (const player of hit.value.squad) {
      if (seen.has(player.name)) continue;
      const score = scoreName(query, { name: player.name });
      if (score.score < 0.7) continue;
      seen.add(player.name);
      hits.push({
        id: `${hit.value.id}~${player.id ?? player.name}`,
        name: player.name,
        team: hit.value.name,
        teamId: hit.value.id,
        detail: player.position ?? player.nationality ?? null,
      });
      if (hits.length >= limit) return hits;
    }
  }
  for (const key of cache.keysWithPrefix('scorers:')) {
    const hit = cache.get<import('@/lib/types').Scorer[]>(key);
    if (!hit) continue;
    for (const scorer of hit.value) {
      if (seen.has(scorer.name)) continue;
      const score = scoreName(query, { name: scorer.name });
      if (score.score < 0.7) continue;
      seen.add(scorer.name);
      hits.push({
        id: `${key}:${scorer.name}`,
        name: scorer.name,
        team: scorer.team.name,
        teamId: scorer.team.id,
        detail: `${scorer.goals}`,
      });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}

function cachedStandingNames(): StandingRow[] {
  const rows: StandingRow[] = [];
  for (const key of cache.keysWithPrefix('standings:')) {
    const hit = cache.get<StandingRow[]>(key);
    if (hit) rows.push(...hit.value);
  }
  return rows;
}

export async function searchUnified(query: string, limit = 15): Promise<DataResult<UnifiedSearchResult>> {
  const trimmed = query.trim().slice(0, 60);
  const normalized = normalizeText(trimmed);
  const empty: UnifiedSearchResult = {
    query: trimmed,
    normalized,
    entities: [],
    teams: [],
    leagues: [],
    players: [],
    matches: [],
    news: [],
    stories: [],
    disambiguation: null,
    expansions: [],
  };
  const fetchedAt = new Date().toISOString();
  if (trimmed.length < 2) {
    return { data: empty, source: 'none', stale: false, fetchedAt };
  }

  // 1. Knowledge model first: an entity match is the strongest signal.
  const entityHits = searchEntities(trimmed, limit);
  const entities: SearchEntityOption[] = entityHits.map((hit) => ({
    id: hit.entity.id,
    slug: hit.entity.slug,
    kind: hit.entity.kind,
    name: hit.entity.name,
    nameAr: hit.entity.nameAr,
    country: hit.entity.country,
    crest: hit.entity.crest,
    score: hit.score,
  }));

  // 2. Provider teams (covers clubs the registry has not learned yet).
  let teams: UnifiedSearchResult['teams'] = [];
  let expansions: string[] = [];
  let providerSource = 'none';
  let providerFailed = false;
  try {
    const providerResult = await searchProviderTeams(trimmed);
    providerSource = providerResult.source;
    expansions = providerResult.expansions;
    teams = providerResult.teams.map((team) => {
      const known = entityHits.find((hit) =>
        hit.entity.kind === 'team' && scoreName(team.name, {
          name: hit.entity.name,
          nameAr: hit.entity.nameAr,
          aliases: hit.entity.aliases,
        }).score >= 0.7,
      );
      return {
        kind: 'team' as const,
        id: team.id,
        name: team.name,
        crest: team.crest,
        league: team.leagueCode,
        country: team.country,
        slug: known?.entity.slug ?? null,
        entityId: known?.entity.id ?? '',
      };
    });
  } catch {
    providerFailed = true;
  }

  // 3. Competitions from the curated catalogue (never provider-dependent).
  const leagues: UnifiedSearchResult['leagues'] = ALL_LEAGUES.filter(
    (league) =>
      matchesQuery(league.nameEn, trimmed) ||
      matchesQuery(league.nameAr, trimmed) ||
      matchesQuery(league.country, trimmed) ||
      matchesQuery(league.countryAr, trimmed),
  ).map((league) => {
    const known = entityHits.find((hit) => hit.entity.kind === 'league' && hit.entity.leagueCodes.includes(league.fdCode));
    return {
      kind: 'league' as const,
      id: league.fdCode,
      code: league.fdCode,
      name: league.nameEn,
      emblem: league.emblem,
      country: league.country,
      slug: known?.entity.slug ?? null,
      entityId: known?.entity.id ?? '',
    };
  });

  // 4. Players / matches from what the instance already holds.
  const players = searchCachedPlayers(trimmed);
  const matches = searchCachedMatches(trimmed);

  // 5. News (only when the operator enabled sources; cached bundle, no fetch storm).
  let news: NewsEntry[] = [];
  let stories: NewsStory[] = [];
  if (newsEnabled()) {
    try {
      const bundle = await getNewsBundle({ limit: 40 });
      news = bundle.data.entries.filter((entry) => scoreText(`${entry.title} ${entry.excerpt}`, trimmed) >= 0.7);
      stories = bundle.data.stories.filter((story) => scoreText(story.entry.title, trimmed) >= 0.7);
    } catch {
      news = [];
      stories = [];
    }
  }

  // 6. Ambiguity: same name, different countries → both offered, never merged.
  const ambiguous = ambiguityOptions(trimmed);
  const disambiguation = ambiguous.length
    ? {
        name: trimmed,
        options: ambiguous.map((entity) => ({
          id: entity.id,
          slug: entity.slug,
          kind: entity.kind,
          name: entity.name,
          nameAr: entity.nameAr,
          country: entity.country,
          crest: entity.crest,
          score: 1,
        })),
      }
    : null;

  // A club mentioned in a cached table but not returned by search still counts:
  // it proves the app already knows the entity and can link to it.
  if (teams.length === 0 && entityHits.length === 0) {
    const standingHit = cachedStandingNames().find((row) => matchesQuery(row.team.name, trimmed));
    if (standingHit) {
      teams = [
        {
          kind: 'team',
          id: standingHit.team.id,
          name: standingHit.team.name,
          crest: standingHit.team.crest,
          league: null,
          country: null,
          slug: null,
          entityId: '',
        },
      ];
    }
  }

  return {
    data: {
      query: trimmed,
      normalized,
      entities,
      teams,
      leagues,
      players,
      matches,
      news,
      stories,
      disambiguation,
      expansions,
    },
    source: providerFailed ? 'mixed' : providerSource,
    stale: false,
    fetchedAt,
  };
}

/** Compact suggestion list for the type-ahead box. */
export function suggestionsFrom(result: UnifiedSearchResult, limit = 8): string[] {
  const out = new Set<string>();
  for (const entity of result.entities) out.add(entity.nameAr ?? entity.name);
  for (const team of result.teams) out.add(team.name);
  for (const league of result.leagues) out.add(league.name);
  for (const player of result.players) out.add(player.name);
  return [...out].slice(0, limit);
}

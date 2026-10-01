import 'server-only';
import type { UnifiedMatch, UnifiedTeam } from '@/lib/types';
import type { EntityRecord } from '@/lib/pure/entity';
import { decodeEntityId } from '@/lib/constants';
import { scoreName, teamSlug, foldText } from '@/lib/pure/entity';
import { withFallback } from '@/lib/providers/registry';
import type { FootballProvider } from '@/lib/providers/base';
import {
  allEntities,
  entitiesByKind,
  entityByRef,
  getEntity,
  registerLeague,
  registerTeam,
} from './registry';
import { leagueByCode } from '@/lib/constants';

export {
  ambiguityReview,
  entityByRef,
  entityConflicts,
  entitiesByKind,
  getEntity,
  registryStats,
  ensureSeeded,
} from './registry';

/**
 * Entity facade: turns provider objects into knowledge-model entities and
 * resolves any route id (internal slug OR legacy provider id) back to a
 * provider record. Nothing in the app should need to know that `fd~57` and
 * `al-ahly-eg` are the same club — this module decides that once.
 */

/** Provider preference when an entity has several refs (best data first). */
const REF_ORDER = ['fd', 'af', 'tsdb', 'espn'];

export interface ResolvedTeamRoute {
  entity: EntityRecord;
  provider: { provider: string; parts: string[] } | null;
  /** True when the caller asked for a legacy provider id rather than the slug. */
  legacyId: boolean;
}

/** Best provider ref of an entity, as a decodable route id. */
export function preferredRef(entity: EntityRecord): { provider: string; parts: string[] } | null {
  const sorted = [...entity.refs].sort(
    (a, b) => REF_ORDER.indexOf(a.provider) - REF_ORDER.indexOf(b.provider),
  );
  for (const ref of sorted) {
    if (!REF_ORDER.includes(ref.provider)) continue;
    const decoded = decodeEntityId(ref.id);
    if (decoded) return { provider: decoded.provider, parts: decoded.parts };
  }
  return null;
}

/**
 * Resolve a `/teams/[id]` parameter.
 *
 * Accepts both forms for ever: the historical provider id (`fd~57`, `tsdb~138995`)
 * keeps working so no existing link or indexed URL breaks, and the entity slug
 * (`al-ahly-eg`) is what new internal links use.
 */
export async function resolveTeamRoute(idOrSlug: string): Promise<ResolvedTeamRoute | null> {
  const decoded = decodeEntityId(idOrSlug);
  if (decoded && REF_ORDER.includes(decoded.provider)) {
    const known = entityByRef(decoded.provider, idOrSlug);
    return {
      entity: known ?? getEntity(idOrSlug) ?? placeholderEntity(idOrSlug),
      provider: { provider: decoded.provider, parts: decoded.parts },
      legacyId: true,
    };
  }

  const entity = getEntity(idOrSlug);
  if (!entity || entity.kind !== 'team') return null;

  const ref = preferredRef(entity);
  if (ref) return { entity, provider: ref, legacyId: false };

  // The seed knows the club but no provider has confirmed it yet: ask the team
  // search once (cached by the provider layer) and register what comes back.
  // When that search cannot run (all providers down), the ENTITY is still real
  // and still gets an honest entity-only page — never a 404 for a known club.
  const found = await findProviderTeam(entity);
  if (!found) return { entity, provider: null, legacyId: false };
  return { entity: found.entity, provider: found.provider, legacyId: false };
}

async function findProviderTeam(entity: EntityRecord): Promise<{ entity: EntityRecord; provider: { provider: string; parts: string[] } } | null> {
  try {
    const { data, source } = await withFallback('searchTeams', (p: FootballProvider) =>
      p.searchTeams(entity.name),
    );
    const scored = data
      .map((team) => ({ team, match: scoreName(entity.name, { name: team.name, nameAr: entity.nameAr, aliases: entity.aliases }) }))
      .filter((candidate) => candidate.match.score >= 0.6)
      .sort((a, b) => b.match.score - a.match.score);

    const countryMatch = scored.find(
      (candidate) =>
        entity.country && candidate.team.country &&
        foldText(candidate.team.country) === foldText(entity.country),
    );
    const chosen = countryMatch ?? scored[0];
    if (!chosen) return null;

    const registered = registerFromProviderTeam(chosen.team, source);
    const ref = preferredRef(registered);
    if (!ref) return null;
    return { entity: registered, provider: ref };
  } catch {
    return null;
  }
}

function placeholderEntity(id: string): EntityRecord {
  return {
    id,
    kind: 'team',
    slug: id.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
    name: id,
    nameAr: null,
    shortName: null,
    country: null,
    countryCode: null,
    leagueCodes: [],
    crest: null,
    aliases: [],
    refs: [],
    updatedAt: null,
  };
}

/** Register (or enrich) a team that a provider just returned. */
export function registerFromProviderTeam(team: UnifiedTeam, source: string, leagueCode?: string | null): EntityRecord {
  return registerTeam({
    name: team.name,
    nameAr: null,
    shortName: team.shortName,
    country: team.country,
    countryCode: team.country ? null : null,
    leagueCode: leagueCode ?? team.leagueCode ?? null,
    crest: team.crest,
    aliases: [],
    refs: [{ provider: source, id: team.id }],
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Learn entities from a batch of matches. Cheap (map lookups + name indexing)
 * and it is what makes news/search/link coverage grow simply by serving pages —
 * no manual registry editing when a new club appears.
 */
export function registerFromMatches(matches: UnifiedMatch[], source: string): void {
  for (const match of matches) {
    for (const side of [match.home, match.away]) {
      registerTeam({
        name: side.name,
        shortName: side.shortName,
        countryCode: null,
        leagueCode: match.league.code ?? null,
        crest: side.crest,
        refs: [{ provider: source, id: side.id }],
      });
    }
    if (match.league.code) {
      const featured = leagueByCode(match.league.code);
      if (featured) registerLeague(featured);
    }
  }
}

/** Slug used in internal links for a team the app is currently rendering. */
export function slugForTeam(team: { id: string; name: string; country?: string | null }, source?: string, leagueCode?: string | null): string {
  const existing = entityByRef(source ?? decodeEntityId(team.id)?.provider ?? '', team.id) ?? getEntity(team.id);
  if (existing) return existing.slug;
  const registered = registerTeam({
    name: team.name,
    country: team.country ?? null,
    countryCode: null,
    leagueCode: leagueCode ?? null,
    crest: (team as { crest?: string | null }).crest ?? null,
    refs: source ? [{ provider: source, id: team.id }] : [],
  });
  return registered.slug;
}

/** Entities a news headline may be linked to (teams + competitions). */
export function linkingHints(): { id: string; names: string[]; label: string; country: string | null }[] {
  return [...entitiesByKind('team'), ...entitiesByKind('league')].map((entity) => ({
    id: entity.id,
    names: [entity.name, entity.nameAr ?? '', ...entity.aliases].filter(Boolean),
    // Arabic-first product: the chip shows the Arabic name whenever we have it.
    label: entity.nameAr ?? entity.name,
    country: entity.country,
  }));
}

export interface EntitySearchHit {
  entity: EntityRecord;
  score: number;
  matchType: string;
}

/** Entity-aware search over the registry (teams, leagues, countries). */
export function searchEntities(query: string, limit = 12): EntitySearchHit[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const hits: EntitySearchHit[] = [];
  for (const entity of allEntities()) {
    if (entity.kind !== 'team' && entity.kind !== 'league' && entity.kind !== 'country') continue;
    const match = scoreName(trimmed, {
      name: entity.name,
      nameAr: entity.nameAr,
      shortName: entity.shortName,
      aliases: entity.aliases,
    });
    if (match.score < 0.45) continue;
    hits.push({ entity, score: match.score, matchType: match.type });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Same-name entities in different countries — surfaced as options, never merged. */
export function ambiguityOptions(query: string): EntityRecord[] {
  const hits = searchEntities(query, 10).filter((hit) => hit.score >= 0.7 && hit.entity.kind === 'team');
  if (hits.length < 2) return [];
  const names = new Set(hits.map((h) => foldText(h.entity.name)));
  if (names.size !== 1) return [];
  const countries = new Set(hits.map((h) => foldText(h.entity.country ?? '')));
  return countries.size >= 2 ? hits.map((h) => h.entity) : [];
}

export function teamSlugValue(name: string, countryCode?: string | null): string {
  return teamSlug(name, countryCode);
}

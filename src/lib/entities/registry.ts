import 'server-only';
import type { EntityRecord, ExternalRef } from '@/lib/pure/entity';
import { entityId, foldText, nameForms, shouldMerge, slugify, teamSlug } from '@/lib/pure/entity';
import type { FeaturedLeague } from '@/lib/constants';
import { ALL_LEAGUES, leagueEntityId } from '@/lib/constants';
import { SEED_TEAMS, SEED_COUNTRIES } from './seed';

/**
 * Internal entity registry — the identity layer of the Football Knowledge Model.
 *
 * Every team, league and country gets ONE internal record with a stable id, a
 * route slug, all names it is known by and the external provider refs that prove
 * it is the same club. Providers keep naming things their own way; the registry
 * is what makes "الأهلي" = "Al Ahly" = "Al Ahly SC" = tsdb 138995 = one page.
 *
 * Storage: in-memory per serverless instance (same documented trade-off as the
 * cache layer — see docs/OPERATIONS.md). Nothing here is user data; losing it
 * on a cold start costs one re-registration from the next provider response.
 */

export interface EntityConflict {
  at: string;
  code: 'ambiguity_review' | 'ref_reassigned' | 'limit_reached';
  detail: string;
  entities: string[];
}

export interface ReviewEntry {
  at: string;
  /** Normalised name that produced the ambiguity. */
  key: string;
  /** Entity ids that share the name but were NOT merged. */
  candidates: string[];
  reason: string;
}

export interface TeamRegistration {
  name: string;
  nameAr?: string | null;
  shortName?: string | null;
  country?: string | null;
  countryCode?: string | null;
  leagueCode?: string | null;
  crest?: string | null;
  aliases?: string[];
  refs?: ExternalRef[];
  updatedAt?: string | null;
}

interface Store {
  entities: Map<string, EntityRecord>;
  byRef: Map<string, string>;
  bySlug: Map<string, string>;
  byNameKey: Map<string, Set<string>>;
  review: ReviewEntry[];
  conflicts: EntityConflict[];
  seeded: boolean;
}

const MAX_REVIEW = 200;
const MAX_ENTITIES = 5000;

const globalForEntities = globalThis as unknown as { __koraEntities?: Store };
const store: Store = globalForEntities.__koraEntities ?? (globalForEntities.__koraEntities = {
  entities: new Map(),
  byRef: new Map(),
  bySlug: new Map(),
  byNameKey: new Map(),
  review: [],
  conflicts: [],
  seeded: false,
});

function refKey(ref: ExternalRef): string {
  return `${ref.provider}:${ref.id}`;
}

function indexName(record: EntityRecord): void {
  for (const form of nameForms(record.name)) {
    const set = store.byNameKey.get(form) ?? new Set<string>();
    set.add(record.id);
    store.byNameKey.set(form, set);
  }
}

function upsert(input: {
  kind: EntityRecord['kind'];
  name: string;
  nameAr?: string | null;
  shortName?: string | null;
  country?: string | null;
  countryCode?: string | null;
  leagueCode?: string | null;
  crest?: string | null;
  aliases?: string[];
  refs: ExternalRef[];
  updatedAt?: string | null;
  /** Caller-supplied URL slug (leagues use their route code, e.g. "egy"). */
  slugHint?: string | null;
}): EntityRecord {
  // 1. Proven identity: any shared provider ref wins outright.
  for (const ref of input.refs) {
    const existingId = store.byRef.get(refKey(ref));
    if (existingId) {
      const existing = store.entities.get(existingId);
      if (existing) return enrich(existing, input);
    }
  }

  // 2. Candidate matches by name — merged only under the strict rules.
  const candidates = new Set<string>();
  for (const form of nameForms(input.name)) {
    for (const id of store.byNameKey.get(form) ?? []) candidates.add(id);
  }
  for (const id of candidates) {
    const candidate = store.entities.get(id);
    if (!candidate || candidate.kind !== input.kind) continue;
    const decision = shouldMerge(
      {
        name: input.name,
        country: input.country,
        leagueCodes: input.leagueCode ? [input.leagueCode] : [],
        refs: input.refs,
      },
      candidate,
    );
    if (decision) return enrich(candidate, input);
    // Name clash without enough evidence: record the ambiguity for review and
    // fall through to create a separate entity. Never a silent merge.
    recordReview(candidate, input);
  }

  // 3. New entity. The slug is what the id is built from, so ids stay unique
  //    even when two clubs genuinely share a name in different countries.
  const baseSlug = (
    input.slugHint
    ?? (input.kind === 'team' ? teamSlug(input.name, input.countryCode ?? null) : slugify(input.name))
  ).slice(0, 60);
  const takenId = store.bySlug.get(baseSlug);
  const taken = takenId ? store.entities.get(takenId) : null;
  const slug = !taken || taken.id === entityId(input.kind, baseSlug)
    ? baseSlug
    : `${baseSlug}-${store.entities.size.toString(36)}`;
  const id = entityId(input.kind, slug);
  const record: EntityRecord = {
    id,
    kind: input.kind,
    slug,
    name: input.name,
    nameAr: input.nameAr ?? null,
    shortName: input.shortName ?? null,
    country: input.country ?? null,
    countryCode: input.countryCode ?? null,
    leagueCodes: input.leagueCode ? [input.leagueCode] : [],
    crest: input.crest ?? null,
    aliases: dedupeAliases(input.aliases ?? [], input.name, input.nameAr ?? null),
    refs: [...input.refs],
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
  if (store.entities.size >= MAX_ENTITIES) {
    store.conflicts.unshift({
      at: new Date().toISOString(),
      code: 'limit_reached',
      detail: `entity registry is full (${MAX_ENTITIES}) — new entities are not cached`,
      entities: [record.id],
    });
    return record;
  }
  store.entities.set(record.id, record);
  store.bySlug.set(record.slug, record.id);
  for (const ref of record.refs) store.byRef.set(refKey(ref), record.id);
  indexName(record);
  return record;
}

function enrich(existing: EntityRecord, input: {
  nameAr?: string | null;
  shortName?: string | null;
  country?: string | null;
  countryCode?: string | null;
  leagueCode?: string | null;
  crest?: string | null;
  aliases?: string[];
  refs: ExternalRef[];
  updatedAt?: string | null;
  /** Caller-supplied URL slug (leagues use their route code, e.g. "egy"). */
  slugHint?: string | null;
}): EntityRecord {
  // Facts already known are never overwritten with empties; new facts fill gaps
  // or add new names/refs. This is the "additive only" rule applied per entity.
  const updated: EntityRecord = {
    ...existing,
    nameAr: existing.nameAr ?? input.nameAr ?? null,
    shortName: existing.shortName ?? input.shortName ?? null,
    country: existing.country ?? input.country ?? null,
    countryCode: existing.countryCode ?? input.countryCode ?? null,
    leagueCodes: input.leagueCode && !existing.leagueCodes.includes(input.leagueCode)
      ? [...existing.leagueCodes, input.leagueCode]
      : existing.leagueCodes,
    crest: existing.crest ?? input.crest ?? null,
    aliases: dedupeAliases(
      [...existing.aliases, ...(input.aliases ?? []), input.nameAr ?? ''].filter(Boolean) as string[],
      existing.name,
      existing.nameAr,
    ),
    refs: existing.refs,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
  for (const ref of input.refs) {
    if (updated.refs.some((r) => r.provider === ref.provider && r.id === ref.id)) continue;
    updated.refs = [...updated.refs, ref];
    const previous = store.byRef.get(refKey(ref));
    if (previous && previous !== updated.id) {
      store.conflicts.unshift({
        at: new Date().toISOString(),
        code: 'ref_reassigned',
        detail: `provider ref ${refKey(ref)} pointed at ${previous}`,
        entities: [previous, updated.id],
      });
    }
    store.byRef.set(refKey(ref), updated.id);
  }
  store.entities.set(updated.id, updated);
  store.bySlug.set(updated.slug, updated.id);
  indexName(updated);
  return updated;
}

function dedupeAliases(aliases: string[], name: string, nameAr: string | null): string[] {
  const seen = new Set<string>([foldText(name), foldText(nameAr ?? '')]);
  const out: string[] = [];
  for (const alias of aliases) {
    const trimmed = alias.trim();
    if (!trimmed || trimmed.length > 80) continue;
    const folded = foldText(trimmed);
    if (seen.has(folded)) continue;
    seen.add(folded);
    out.push(trimmed);
  }
  return out.slice(0, 24);
}

function recordReview(candidate: EntityRecord, input: { name: string; country?: string | null; leagueCode?: string | null }): void {
  const key = nameForms(input.name)[0] ?? foldText(input.name);
  const detail = `"${input.name}" (${input.country ?? 'country unknown'}${input.leagueCode ? `, ${input.leagueCode}` : ''}) vs ${candidate.id} (${candidate.country ?? 'country unknown'})`;
  const existing = store.review.find((r) => r.key === key && r.candidates.includes(candidate.id));
  if (!existing) {
    store.review.unshift({
      at: new Date().toISOString(),
      key,
      candidates: [candidate.id],
      reason: detail,
    });
    if (store.review.length > MAX_REVIEW) store.review.length = MAX_REVIEW;
  }
  store.conflicts.unshift({
    at: new Date().toISOString(),
    code: 'ambiguity_review',
    detail,
    entities: [candidate.id],
  });
  if (store.conflicts.length > MAX_REVIEW) store.conflicts.length = MAX_REVIEW;
}

/** Register (or enrich) a team entity from provider data. */
export function registerTeam(input: TeamRegistration): EntityRecord {
  ensureSeeded();
  return upsert({
    kind: 'team',
    name: input.name,
    nameAr: input.nameAr ?? null,
    shortName: input.shortName ?? null,
    country: input.country ?? null,
    countryCode: input.countryCode ?? null,
    leagueCode: input.leagueCode ?? null,
    crest: input.crest ?? null,
    aliases: input.aliases ?? [],
    refs: input.refs ?? [],
    updatedAt: input.updatedAt ?? null,
  });
}

/** Register a competition from the curated catalogue (real, stable data). */
export function registerLeague(league: FeaturedLeague): EntityRecord {
  ensureSeeded();
  return upsert({
    kind: 'league',
    name: league.nameEn,
    nameAr: league.nameAr,
    country: league.country,
    countryCode: league.country.toLowerCase().slice(0, 3),
    leagueCode: league.fdCode,
    aliases: [league.countryAr, league.country],
    refs: [{ provider: 'catalog', id: leagueEntityId(league) }],
    slugHint: league.fdCode.toLowerCase(),
  });
}

export function registerCountry(name: string, nameAr?: string, code?: string): EntityRecord {
  ensureSeeded();
  return upsert({
    kind: 'country',
    name,
    nameAr: nameAr ?? null,
    country: name,
    countryCode: code ?? null,
    refs: [{ provider: 'catalog', id: `country:${foldText(name)}` }],
    slugHint: code ?? foldText(name).replace(/\s+/g, '-'),
  });
}

/** Seed the registry with the verified catalogue + curated clubs. Idempotent. */
export function ensureSeeded(): void {
  if (store.seeded) return;
  store.seeded = true;
  for (const league of ALL_LEAGUES) registerLeague(league);
  for (const country of SEED_COUNTRIES) registerCountry(country.name, country.nameAr, country.code);
  for (const team of SEED_TEAMS) {
    registerTeam({
      name: team.name,
      nameAr: team.nameAr,
      country: team.country,
      countryCode: team.countryCode,
      leagueCode: team.leagueCodes[0] ?? null,
      aliases: team.aliases,
      refs: team.wikidata ? [{ provider: 'wikidata', id: team.wikidata }] : [],
    });
  }
}

export function getEntity(idOrSlug: string): EntityRecord | null {
  ensureSeeded();
  if (!idOrSlug) return null;
  const direct = store.entities.get(idOrSlug);
  if (direct) return direct;
  const bySlug = store.bySlug.get(idOrSlug);
  if (bySlug) return store.entities.get(bySlug) ?? null;
  // A bare slug ("al-ahly") should still find "al-ahly-eg" when unambiguous.
  const matches = [...store.entities.values()].filter((e) => e.slug === idOrSlug || e.slug.startsWith(`${idOrSlug}-`));
  return matches.length === 1 ? matches[0] : null;
}

export function entityByRef(provider: string, id: string): EntityRecord | null {
  ensureSeeded();
  const entityIdValue = store.byRef.get(`${provider}:${id}`);
  return entityIdValue ? store.entities.get(entityIdValue) ?? null : null;
}

export function entitiesByKind(kind: EntityRecord['kind']): EntityRecord[] {
  ensureSeeded();
  return [...store.entities.values()].filter((e) => e.kind === kind);
}

export function allEntities(): EntityRecord[] {
  ensureSeeded();
  return [...store.entities.values()];
}

/** Ambiguities awaiting a human decision — reported by the diagnostics endpoint. */
export function ambiguityReview(limit = 50): ReviewEntry[] {
  return store.review.slice(0, limit);
}

export function entityConflicts(limit = 50): EntityConflict[] {
  return store.conflicts.slice(0, limit);
}

export function registryStats(): { entities: number; refs: number; review: number } {
  return { entities: store.entities.size, refs: store.byRef.size, review: store.review.length };
}

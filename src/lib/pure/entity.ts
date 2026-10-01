/**
 * Football Knowledge Model — pure entity identity helpers.
 *
 * Everything in the platform is an ENTITY with a stable internal id, external
 * provider refs, display names in both languages and a confidence-scored link.
 * This module owns the alias-free, IO-free half of that model so it can be
 * unit-tested directly with Node's type stripping (no imports, no server-only).
 *
 * Hard rules encoded here:
 *   • A team is never merged on name alone. Merging requires a shared provider
 *     ref, or the same normalised name AND the same country/competition.
 *   • Alike names in different countries stay separate entities and are
 *     reported as an ambiguity (never auto-merged) — e.g. Al Ahly (Egypt) vs
 *     Al Ahly (Saudi Arabia).
 */

export type EntityKind =
  | 'team'
  | 'player'
  | 'coach'
  | 'league'
  | 'season'
  | 'country'
  | 'match'
  | 'venue'
  | 'story'
  | 'source';

export interface ExternalRef {
  provider: string;
  id: string;
}

export interface EntityRecord {
  /** Stable internal id, e.g. `team:al-ahly-eg`. Never provider-scoped. */
  id: string;
  kind: EntityKind;
  /** URL-safe identifier used in routes. */
  slug: string;
  /** Canonical display name (provider spelling, usually Latin). */
  name: string;
  nameAr: string | null;
  shortName: string | null;
  country: string | null;
  countryCode: string | null;
  /** Route codes of the competitions this entity participates in. */
  leagueCodes: string[];
  /** Crest/badge URL supplied by a provider (never invented, never hotlinked from scraped pages). */
  crest: string | null;
  aliases: string[];
  refs: ExternalRef[];
  /** ISO — last time any provider enriched this entity. */
  updatedAt: string | null;
}

const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const ARABIC_INDIC = /[\u0660-\u0669\u06F0-\u06F9]/g;

function mapDigit(ch: string): string {
  const code = ch.charCodeAt(0);
  return code >= 0x0660 && code <= 0x0669 ? String(code - 0x0660) : String(code - 0x06f0);
}

/** Arabic/Latin case-fold used for every entity comparison. */
export function foldText(input: string): string {
  if (!input) return '';
  return input
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .replace(ARABIC_INDIC, mapDigit)
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627') // أ إ آ ٱ → ا
    .replace(/[\u0649\u0626\u064A]/g, '\u064A') // ى ئ ي → ي
    .replace(/[\u0629\u0647]/g, '\u0647') // ة ه → ه
    .replace(/[\u0624\u0648]/g, '\u0648') // ؤ و → و
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Club/company noise that must not change identity: "Al Ahly SC" === "Al Ahly". */
const AFFIXES = [
  'sc', 'fc', 'cf', 'ac', 'afc', 'cfc', 'club', 'sporting', 'sport', 'sports',
  'football', 'futbol', 'association', 'team', 'the',
  'نادي', 'نادى', 'فريق', 'الرياضي', 'الرياضيه', 'لكره', 'القدم', 'كوره',
];

/** Name variants used for matching (never for display). */
export function nameForms(name: string): string[] {
  const folded = foldText(name);
  if (!folded) return [];
  const tokens = folded.split(' ').filter((t) => !AFFIXES.includes(t));
  const stripped = tokens.join(' ').trim();
  const forms = new Set<string>([folded]);
  if (stripped) forms.add(stripped);
  // "al ahly" ↔ "ahly": the Arabic definite article is not part of a name.
  if (stripped.startsWith('al ')) forms.add(stripped.slice(3).trim());
  return Array.from(forms).filter(Boolean);
}

/** Latin slug; Arabic-only names fall back to a deterministic short hash. */
export function slugify(value: string): string {
  const ascii = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii) return ascii.slice(0, 60);
  return `x${hash32(value).toString(36)}`;
}

export function hash32(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

/**
 * Stable team slug. A country code is appended only when the caller knows it,
 * which is exactly what keeps Al Ahly (EG) and Al Ahly (SA) apart in URLs.
 */
export function teamSlug(name: string, countryCode?: string | null): string {
  const base = slugify(name);
  return countryCode ? `${base}-${countryCode.toLowerCase()}` : base;
}

export function entityId(kind: EntityKind, slug: string): string {
  return `${kind}:${slug}`;
}

export function playerSlug(name: string, teamSlugValue: string): string {
  return `${slugify(name)}-${teamSlugValue}`.slice(0, 90);
}

/** Levenshtein distance with early exit (used for small typo tolerance). */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

function bigrams(value: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < value.length - 1; i += 1) out.add(value.slice(i, i + 2));
  return out;
}

/** Dice coefficient over character bigrams (script-agnostic). */
export function bigramDice(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let shared = 0;
  for (const g of A) if (B.has(g)) shared += 1;
  return (2 * shared) / (A.size + B.size);
}

/** Token Jaccard similarity over word sets. */
export function tokenJaccard(a: string, b: string): number {
  const A = new Set(a.split(' ').filter(Boolean));
  const B = new Set(b.split(' ').filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared += 1;
  return shared / (A.size + B.size - shared);
}

export type MatchType = 'ref' | 'exact' | 'alias' | 'prefix' | 'token' | 'fuzzy' | 'none';

export interface NameMatch {
  score: number; // 0..1
  type: MatchType;
}

/** Every string a user could reasonably type for this entity. */
export function entityNames(entity: {
  name: string;
  nameAr?: string | null;
  shortName?: string | null;
  aliases?: string[];
}): string[] {
  return [entity.name, entity.nameAr ?? '', entity.shortName ?? '', ...(entity.aliases ?? [])]
    .map((n) => n.trim())
    .filter(Boolean);
}

/**
 * Score one entity against a user query. Ordering of the checks matters:
 * exact → alias → prefix → token containment → fuzzy (typos only).
 */
export function scoreName(query: string, entity: Parameters<typeof entityNames>[0]): NameMatch {
  const q = foldText(query);
  if (!q) return { score: 0, type: 'none' };
  const qForms = nameForms(q);
  let best: NameMatch = { score: 0, type: 'none' };

  for (const raw of entityNames(entity)) {
    for (const form of nameForms(raw)) {
      if (!form) continue;
      if (form === q) return { score: 1, type: 'exact' };
      if (qForms.includes(form)) {
        best = pick(best, { score: 0.98, type: 'alias' });
        continue;
      }
      if (form.startsWith(q) || q.startsWith(form)) {
        const ratio = Math.min(form.length, q.length) / Math.max(form.length, q.length);
        best = pick(best, { score: 0.7 + 0.2 * ratio, type: 'prefix' });
        continue;
      }
      if (form.includes(q)) {
        best = pick(best, { score: 0.62, type: 'token' });
        continue;
      }
      // Typo tolerance only for reasonably long queries — "ريال" vs "ريالا"
      // must not pull in unrelated short names.
      if (q.length >= 4) {
        const dist = editDistance(q, form, 2);
        if (dist <= 2) {
          const penalty = Math.abs(form.length - q.length) + dist;
          best = pick(best, { score: Math.max(0.3, 0.8 - 0.12 * penalty), type: 'fuzzy' });
          continue;
        }
        const dice = bigramDice(q, form);
        if (dice >= 0.72) best = pick(best, { score: 0.55 + (dice - 0.72), type: 'fuzzy' });
      }
    }
  }
  return best;
}

function pick(current: NameMatch, candidate: NameMatch): NameMatch {
  return candidate.score > current.score ? candidate : current;
}

/** Did the user query this entity at all? (search filtering helper) */
export function matchesEntity(query: string, entity: Parameters<typeof entityNames>[0]): boolean {
  return scoreName(query, entity).score >= 0.6;
}

export interface AmbiguityGroup<T> {
  key: string;
  options: T[];
}

/**
 * Group entities that share a folded name but carry different countries —
 * the exact Al Ahly (Egypt) vs Al Ahly (Saudi) situation. Returns only real
 * ambiguities (2+ options with at least two known, different countries).
 */
export function ambiguityGroups<T extends { name: string; country?: string | null }>(
  entities: T[],
): AmbiguityGroup<T>[] {
  const byName = new Map<string, T[]>();
  for (const entity of entities) {
    const key = nameForms(entity.name)[0] ?? foldText(entity.name);
    if (!key) continue;
    const list = byName.get(key);
    if (list) list.push(entity);
    else byName.set(key, [entity]);
  }
  const groups: AmbiguityGroup<T>[] = [];
  for (const [key, list] of byName) {
    if (list.length < 2) continue;
    const countries = new Set(list.map((e) => (e.country ? foldText(e.country) : '')).filter(Boolean));
    if (countries.size >= 2) groups.push({ key, options: list });
  }
  return groups;
}

/**
 * The only automatic merge decision the system is allowed to make.
 * `strong` = a shared provider ref (same club, provably). `weak` = same name
 * and same country/competition (still safe, because both axes agree).
 * Anything weaker returns null → the caller creates a separate entity and
 * records it for human review instead of guessing.
 */
export function shouldMerge(
  incoming: { name: string; country?: string | null; leagueCodes?: string[]; refs?: ExternalRef[] },
  existing: EntityRecord,
): 'strong' | 'weak' | null {
  const incomingRefs = incoming.refs ?? [];
  if (existing.refs.some((r) => incomingRefs.some((i) => i.provider === r.provider && i.id === r.id))) {
    return 'strong';
  }
  const sameName = nameForms(incoming.name).some((form) => nameForms(existing.name).includes(form));
  if (!sameName) return null;

  const incomingCountry = incoming.country ? foldText(incoming.country) : '';
  const existingCountry = existing.country ? foldText(existing.country) : '';
  if (incomingCountry && existingCountry && incomingCountry !== existingCountry) return null; // ← ambiguity, never auto-merge
  if (incomingCountry && existingCountry && incomingCountry === existingCountry) return 'weak';

  const incomingLeagues = new Set(incoming.leagueCodes ?? []);
  const sharesLeague = existing.leagueCodes.some((code) => incomingLeagues.has(code));
  if (sharesLeague) return 'weak';
  return null;
}

/** Compact, human-readable id for review queues (no PII, no provider URLs). */
export function reviewKey(normalizedName: string): string {
  return `review:${normalizedName}`;
}

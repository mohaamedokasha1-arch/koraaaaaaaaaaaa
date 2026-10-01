import { ALL_LEAGUES } from '../../../lib/constants.ts';

/** Public football facts only. No visitor contact details or account credentials. */
export const PREFERENCES_KEY = 'korascore:preferences:v1';
export const PREFERENCES_VERSION = 1;
export const MAX_FAVORITES = 60;
export const MAX_PREFERENCES_BYTES = 64 * 1024;

export type FavoriteKind = 'team' | 'league' | 'player';
export interface Favorite {
  kind: FavoriteKind;
  /** Existing internal team/league id, or a provider-scoped player id. */
  id: string;
  name: string;
  nameAr: string | null;
  country: string | null;
  crest: string | null;
  slug: string | null;
  providerId: string | null;
  teamId: string | null;
  teamName: string | null;
  leagueCode: string | null;
  origin: 'squad' | 'scorers' | null;
}
export interface Preferences {
  version: 1;
  dashboardEnabled: boolean;
  favorites: Favorite[];
}
export interface FavoriteOption {
  favorite: Favorite;
  /** Existing aliases, used for catalogue filtering, not persisted. */
  searchTerms: string[];
}
export type FavoriteCatalog = Record<FavoriteKind, FavoriteOption[]>;

const LEAGUE_CODES = new Set(ALL_LEAGUES.map((league) => league.fdCode));
const TEAM_ID = /^team:([a-z0-9][a-z0-9-]{0,99})$/;
const PROVIDER_TEAM_ID = /^(?:fd|af|tsdb|espn)~[1-9]\d{0,11}$/;
const PROVIDER_PLAYER_ID = /^(?:fd|af)~[1-9]\d{0,11}$/;
const CREST_HOSTS = new Set([
  'upload.wikimedia.org', 'crests.football-data.org', 'www.thesportsdb.com',
  'r2.thesportsdb.com', 'a.espncdn.com', 'media.api-sports.io',
]);

export function isLeagueCode(value: unknown): value is string {
  return typeof value === 'string' && LEAGUE_CODES.has(value);
}
export function isProviderTeamId(value: unknown): value is string {
  return typeof value === 'string' && PROVIDER_TEAM_ID.test(value);
}
export function isTeamFavoriteId(value: unknown): value is string {
  return typeof value === 'string' && TEAM_ID.test(value);
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function text(value: unknown, limit = 100): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (!clean || clean.length > limit || /[\u0000-\u001f\u007f]/.test(clean)) return null;
  return clean;
}

/** Stored URLs are never allowed to become arbitrary tracking/image endpoints. */
export function safeFavoriteCrest(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 800) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (!url.port || url.port === '443') && url.href.length <= 800 && CREST_HOSTS.has(url.hostname)
      ? url.href : null;
  } catch { return null; }
}

/** Strip unknown fields; routes are derived below, never read from storage. */
export function parseFavorite(value: unknown): Favorite | null {
  if (!record(value)) return null;
  const { kind, id } = value;
  const name = text(value.name);
  if (!name || !/[\p{L}\p{N}]/u.test(name) || typeof id !== 'string') return null;
  const providerId = value.providerId == null ? null : value.providerId;
  const leagueCode = value.leagueCode == null ? null : value.leagueCode;
  if (leagueCode !== null && !isLeagueCode(leagueCode)) return null;

  let slug: string | null = null;
  let teamId: string | null = null;
  let origin: Favorite['origin'] = null;
  if (kind === 'team') {
    const match = TEAM_ID.exec(id);
    if (!match || (providerId !== null && !isProviderTeamId(providerId))) return null;
    slug = match[1];
    if (value.slug !== slug) return null;
  } else if (kind === 'league') {
    if (!isLeagueCode(leagueCode) || id !== `league:${leagueCode.toLowerCase()}` || providerId !== null) return null;
  } else if (kind === 'player') {
    if (typeof providerId !== 'string' || !PROVIDER_PLAYER_ID.test(providerId) || id !== `player:${providerId}`) return null;
    teamId = isProviderTeamId(value.teamId) ? value.teamId : null;
    if (value.origin === 'squad') {
      if (!teamId || teamId.split('~')[0] !== providerId.split('~')[0]) return null;
      origin = 'squad';
    } else if (value.origin === 'scorers' && isLeagueCode(leagueCode)) {
      origin = 'scorers';
    } else return null;
  } else return null;

  return {
    kind, id, name, nameAr: text(value.nameAr), country: text(value.country),
    crest: safeFavoriteCrest(value.crest), slug, providerId: providerId as string | null,
    teamId, teamName: kind === 'player' ? text(value.teamName) : null,
    leagueCode: leagueCode as string | null, origin,
  };
}

export function defaultPreferences(): Preferences {
  return { version: 1, dashboardEnabled: true, favorites: [] };
}

/** Proven identities only — never merge namesakes by a display name. */
export function sameFavorite(a: Favorite, b: Favorite): boolean {
  return a.kind === b.kind && (a.id === b.id || Boolean(
    a.providerId && b.providerId && a.providerId === b.providerId,
  ));
}
export function hasFavorite(preferences: Preferences, favorite: Favorite): boolean {
  return preferences.favorites.some((entry) => sameFavorite(entry, favorite));
}

export interface DecodedPreferences {
  value: Preferences;
  state: 'ok' | 'repaired' | 'unsupported';
}
export function decodePreferences(raw: string | null): DecodedPreferences {
  if (raw === null) return { value: defaultPreferences(), state: 'ok' };
  try {
    if (raw.length > MAX_PREFERENCES_BYTES || new TextEncoder().encode(raw).length > MAX_PREFERENCES_BYTES) throw new Error('oversize');
    const input: unknown = JSON.parse(raw);
    if (!record(input)) throw new Error('invalid');
    // Fail closed; never silently overwrite a newer version of a user's data.
    if (typeof input.version === 'number' && input.version > PREFERENCES_VERSION) {
      return { value: defaultPreferences(), state: 'unsupported' };
    }
    if (input.version !== PREFERENCES_VERSION || !Array.isArray(input.favorites) || typeof input.dashboardEnabled !== 'boolean') throw new Error('invalid');
    let repaired = false;
    const favorites: Favorite[] = [];
    for (const item of input.favorites.slice(0, MAX_FAVORITES * 2)) {
      const favorite = parseFavorite(item);
      if (!favorite || favorites.some((entry) => sameFavorite(entry, favorite)) || favorites.length >= MAX_FAVORITES) {
        repaired = true;
        continue;
      }
      favorites.push(favorite);
    }
    if (input.favorites.length > MAX_FAVORITES * 2) repaired = true;
    return {
      value: { version: 1, dashboardEnabled: input.dashboardEnabled, favorites },
      state: repaired ? 'repaired' : 'ok',
    };
  } catch { return { value: defaultPreferences(), state: 'repaired' }; }
}

/** A write must always remain readable by the bounded decoder. */
export function encodePreferences(preferences: Preferences, reserveBytes = 0): string | null {
  const encoded = JSON.stringify(preferences);
  return new TextEncoder().encode(encoded).byteLength <= MAX_PREFERENCES_BYTES - reserveBytes ? encoded : null;
}

export type PreferenceError = 'invalid' | 'limit' | 'size' | 'unsupported';
export function toggleFavorite(preferences: Preferences, input: unknown): { value: Preferences; error?: PreferenceError } {
  const favorite = parseFavorite(input);
  if (!favorite) return { value: preferences, error: 'invalid' };
  if (hasFavorite(preferences, favorite)) {
    return { value: { ...preferences, favorites: preferences.favorites.filter((entry) => !sameFavorite(entry, favorite)) } };
  }
  if (preferences.favorites.length >= MAX_FAVORITES) return { value: preferences, error: 'limit' };
  const value = { ...preferences, favorites: [...preferences.favorites, favorite] };
  // Reserve room for the visibility setting, so opting out never grows a valid
  // app-created document past the decoder ceiling.
  if (encodePreferences(value, 32) === null) return { value: preferences, error: 'size' };
  return { value };
}

export function favoriteLabel(favorite: Favorite, locale: 'ar' | 'en'): string {
  return locale === 'ar' ? favorite.nameAr ?? favorite.name : favorite.name;
}
export function playerAnchor(providerId: string): string {
  return `player-${providerId.replace('~', '-')}`;
}
export function favoriteHref(favorite: Favorite, locale: 'ar' | 'en'): string {
  // Use the existing team-detail-capable provider routes. ESPN only exposes
  // scoreboards in this adapter; its club ref is still useful for filtering,
  // but its unsupported getTeam route must not replace a known entity slug.
  if (favorite.kind === 'team') {
    const routeId = favorite.providerId?.startsWith('espn~') ? favorite.slug : favorite.providerId ?? favorite.slug;
    return `/${locale}/teams/${routeId}`;
  }
  if (favorite.kind === 'league') return `/${locale}/leagues/${favorite.leagueCode}`;
  if (favorite.origin === 'scorers') return `/${locale}/top-scorers?league=${favorite.leagueCode}#${playerAnchor(favorite.providerId!)}`;
  return `/${locale}/teams/${favorite.teamId}?tab=squad#${playerAnchor(favorite.providerId!)}`;
}

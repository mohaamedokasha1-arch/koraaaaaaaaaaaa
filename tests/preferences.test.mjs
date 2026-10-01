import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PREFERENCES_KEY, MAX_FAVORITES, MAX_PREFERENCES_BYTES, defaultPreferences,
  parseFavorite, decodePreferences, toggleFavorite, hasFavorite, sameFavorite,
  favoriteHref, favoriteLabel, safeFavoriteCrest,
} from '../src/features/personalization/lib/preferences.ts';
import { createPreferencesStore } from '../src/features/personalization/lib/store.ts';

// Public club/catalogue facts; synthetic IDs below are validation cases only.
const ahly = () => parseFavorite({ kind: 'team', id: 'team:al-ahly-eg', slug: 'al-ahly-eg', name: 'Al Ahly', nameAr: 'الأهلي', country: 'Egypt', leagueCode: 'EGY' });
const arsenal = () => parseFavorite({ kind: 'team', id: 'team:arsenal-eng', slug: 'arsenal-eng', name: 'Arsenal', providerId: 'fd~57', leagueCode: 'PL' });
const league = () => parseFavorite({ kind: 'league', id: 'league:egy', name: 'Egyptian Premier League', nameAr: 'الدوري المصري الممتاز', leagueCode: 'EGY' });
function memoryStorage(initial = null) {
  let value = initial;
  return { getItem: () => value, setItem: (key, next) => { assert.equal(key, PREFERENCES_KEY); value = next; }, removeItem: () => { value = null; }, raw: () => value };
}
const document = (favorites, dashboardEnabled = true, version = 1) => JSON.stringify({ version, favorites, dashboardEnabled });

test('local preferences are empty by default; no account or session fields exist', () => {
  assert.deepEqual(defaultPreferences(), { version: 1, dashboardEnabled: true, favorites: [] });
  assert.equal(decodePreferences(null).state, 'ok');
  assert.equal(PREFERENCES_KEY, 'korascore:preferences:v1');
});

test('follows add/remove immutably and removal does not reset the dashboard flag', () => {
  const original = defaultPreferences();
  const added = toggleFavorite(original, ahly()).value;
  assert.equal(original.favorites.length, 0);
  assert.equal(hasFavorite(added, ahly()), true);
  const removed = toggleFavorite({ ...added, dashboardEnabled: false }, ahly()).value;
  assert.equal(removed.favorites.length, 0);
  assert.equal(removed.dashboardEnabled, false);
});

test('same-name clubs stay separate; a proven provider ref deduplicates aliases', () => {
  const a = arsenal();
  const other = parseFavorite({ ...a, id: 'team:arsenal-other', slug: 'arsenal-other', providerId: 'fd~999', country: 'Other test country' });
  assert.equal(sameFavorite(a, other), false);
  const alias = parseFavorite({ ...a, id: 'team:arsenal-alias', slug: 'arsenal-alias' });
  assert.equal(sameFavorite(a, alias), true);
  const decoded = decodePreferences(document([a, alias, other]));
  assert.equal(decoded.state, 'repaired');
  assert.equal(decoded.value.favorites.length, 2);
});

test('player IDs are provider scoped, stable across teams, and never name based', () => {
  const player = { kind: 'player', id: 'player:fd~101', providerId: 'fd~101', name: 'Isolated test player', origin: 'squad', teamId: 'fd~57', leagueCode: 'PL' };
  assert.ok(parseFavorite(player));
  assert.equal(parseFavorite({ ...player, providerId: null }), null);
  assert.equal(parseFavorite({ ...player, id: 'player:by-name' }), null);
  assert.equal(parseFavorite({ ...player, providerId: 'tsdb~101', id: 'player:tsdb~101' }), null);
  assert.equal(parseFavorite({ ...player, teamId: 'af~57' }), null);
  assert.equal(sameFavorite(parseFavorite(player), parseFavorite({ ...player, teamId: 'fd~64' })), true);
  assert.equal(sameFavorite(parseFavorite(player), parseFavorite({ ...player, id: 'player:af~101', providerId: 'af~101', teamId: 'af~57' })), false);
});

test('missing player and unsupported league identifiers do not produce fake favourites', () => {
  assert.equal(parseFavorite({ kind: 'player', name: 'Name only' }), null);
  assert.equal(parseFavorite({ kind: 'league', id: 'league:invented', name: 'Invented', leagueCode: 'INVENTED' }), null);
  assert.equal(parseFavorite({ ...league(), id: 'league:pl' }), null);
  assert.equal(parseFavorite({ ...ahly(), name: '—' }), null);
});

test('routes and unknown sensitive fields are never copied out of a local document', () => {
  const parsed = parseFavorite({ ...ahly(), href: 'javascript:alert(1)', email: 'not-stored', password: 'not-stored', token: 'not-stored', '__proto__': { admin: true } });
  assert.deepEqual(Object.keys(parsed).sort(), Object.keys(ahly()).sort());
  assert.equal(favoriteHref(parsed, 'ar'), '/ar/teams/al-ahly-eg');
  assert.equal(Object.hasOwn(parsed, 'password'), false);
  assert.equal({}.admin, undefined);
});

test('route traversal, malformed provider IDs and control characters are rejected', () => {
  for (const id of ['team:../admin', 'team:%2fadmin', 'team:x/y', 'team:x?query=1']) assert.equal(parseFavorite({ ...ahly(), id, slug: id.slice(5) }), null);
  assert.equal(parseFavorite({ ...arsenal(), providerId: 'fd~57~extra' }), null);
  assert.equal(parseFavorite({ ...arsenal(), providerId: 'fd~0' }), null);
  assert.equal(parseFavorite({ ...ahly(), name: 'Bad\u0000name' }), null);
});

test('crest allowlist blocks arbitrary hosts, credentials, ports, data and script URLs', () => {
  const valid = 'https://crests.football-data.org/57.png';
  assert.equal(safeFavoriteCrest(valid), valid);
  for (const value of ['https://evil.example/track', 'https://crests.football-data.org.evil.example/57.png', 'https://user:pass@crests.football-data.org/57.png', 'http://crests.football-data.org/57.png', 'https://crests.football-data.org:444/57.png', 'javascript:alert(1)', 'data:image/svg+xml,a']) assert.equal(safeFavoriteCrest(value), null);
});

test('limits stay bounded, but a full list can always remove an entry', () => {
  const favorites = Array.from({ length: MAX_FAVORITES }, (_, index) => parseFavorite({ ...ahly(), id: `team:isolated-${index}`, slug: `isolated-${index}` }));
  const preferences = { ...defaultPreferences(), favorites };
  assert.equal(toggleFavorite(preferences, arsenal()).error, 'limit');
  assert.equal(toggleFavorite(preferences, favorites[0]).value.favorites.length, MAX_FAVORITES - 1);
  assert.equal(decodePreferences(document([...favorites, arsenal()])).value.favorites.length, MAX_FAVORITES);
});

test('corrupt JSON is repaired without silently rewriting disk; valid records survive bad entries', () => {
  assert.equal(decodePreferences('{not-json').state, 'repaired');
  const storage = memoryStorage('{not-json');
  const store = createPreferencesStore(() => storage);
  const unsubscribe = store.subscribe(() => {});
  assert.equal(storage.raw(), '{not-json');
  assert.equal(store.getSnapshot().persistence, 'repaired');
  const decoded = decodePreferences(document([ahly(), { kind: 'invalid' }, league()]));
  assert.equal(decoded.value.favorites.length, 2);
  assert.equal(decoded.state, 'repaired');
  unsubscribe();
});

test('the byte cap also covers Arabic UTF-8 and huge local payloads', () => {
  assert.equal(decodePreferences(' '.repeat(MAX_PREFERENCES_BYTES + 1)).state, 'repaired');
  const raw = JSON.stringify({ version: 1, dashboardEnabled: true, favorites: [], junk: 'ع'.repeat(MAX_PREFERENCES_BYTES / 2) });
  assert.ok(raw.length < MAX_PREFERENCES_BYTES);
  assert.equal(decodePreferences(raw).state, 'repaired');
});

test('a future version blocks edits until an explicit clear, preserving the original bytes', () => {
  const raw = document([ahly()], true, 2);
  const storage = memoryStorage(raw);
  const store = createPreferencesStore(() => storage);
  store.subscribe(() => {});
  assert.equal(store.getSnapshot().persistence, 'unsupported');
  assert.equal(store.toggle(arsenal()).error, 'unsupported');
  assert.equal(store.setDashboardEnabled(false).error, 'unsupported');
  assert.equal(storage.raw(), raw);
  assert.equal(store.clear().persisted, true);
  assert.equal(storage.raw(), null);
  assert.equal(store.toggle(arsenal()).persisted, true);
});

test('blocked localStorage remains usable in memory and never claims persistence', () => {
  const store = createPreferencesStore(() => { throw new Error('SecurityError'); });
  store.subscribe(() => {});
  assert.equal(store.getSnapshot().persistence, 'memory');
  assert.equal(store.toggle(ahly()).persisted, false);
  assert.equal(store.getSnapshot().preferences.favorites.length, 1);
  assert.equal(store.setDashboardEnabled(false).persisted, false);
  assert.equal(store.getSnapshot().preferences.dashboardEnabled, false);
  assert.equal(store.toggle(ahly()).persisted, false);
  assert.equal(store.getSnapshot().preferences.favorites.length, 0);
});

test('quota failures retain temporary edits instead of rereading away a change', () => {
  const storage = { getItem: () => document([]), setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => { throw new Error('blocked'); } };
  const store = createPreferencesStore(() => storage);
  store.subscribe(() => {});
  store.toggle(ahly()); store.toggle(league());
  assert.equal(store.getSnapshot().preferences.favorites.length, 2);
  assert.equal(store.getSnapshot().persistence, 'memory');
  assert.equal(store.clear().persisted, false);
});

test('storage refresh and reread-before-mutation retain committed changes from another tab', () => {
  const storage = memoryStorage();
  const a = createPreferencesStore(() => storage);
  const b = createPreferencesStore(() => storage);
  a.subscribe(() => {}); b.subscribe(() => {});
  a.toggle(ahly());
  b.toggle(league()); // reads A before adding, does not overwrite it
  assert.equal(b.getSnapshot().preferences.favorites.length, 2);
  a.refresh();
  assert.equal(a.getSnapshot().preferences.favorites.length, 2);
  b.clear(); a.refresh();
  assert.equal(a.getSnapshot().preferences.favorites.length, 0);
});

test('SSR snapshots always stay anonymous and stable; listeners unsubscribe cleanly', () => {
  const store = createPreferencesStore(() => memoryStorage());
  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications++);
  store.toggle(ahly());
  assert.equal(notifications, 1);
  const server = store.getServerSnapshot();
  assert.equal(server.ready, false);
  assert.equal(server.preferences.favorites.length, 0);
  assert.equal(server, store.getServerSnapshot());
  assert.equal(store.getSnapshot(), store.getSnapshot());
  unsubscribe(); store.toggle(league());
  assert.equal(notifications, 1);
});

test('Arabic/English labels and source routes retain existing page contracts', () => {
  assert.equal(favoriteLabel(ahly(), 'ar'), 'الأهلي');
  assert.equal(favoriteLabel(ahly(), 'en'), 'Al Ahly');
  assert.equal(favoriteHref(arsenal(), 'en'), '/en/teams/fd~57');
  assert.equal(favoriteHref(parseFavorite({ ...arsenal(), providerId: 'espn~359' }), 'en'), '/en/teams/arsenal-eng');
  assert.equal(favoriteHref(league(), 'ar'), '/ar/leagues/EGY');
  const player = parseFavorite({ kind: 'player', id: 'player:fd~101', providerId: 'fd~101', name: 'Isolated player', origin: 'scorers', leagueCode: 'PL' });
  assert.equal(favoriteHref(player, 'en'), '/en/top-scorers?league=PL#player-fd-101');
});

test('new writes obey the decoder byte budget and leave room to opt out without losing follows', () => {
  const storage = memoryStorage(); const store = createPreferencesStore(() => storage); store.subscribe(() => {});
  let lastDocument;
  for (let index = 0; index < 60; index++) {
    const favorite = parseFavorite({ ...ahly(), id: `team:byte-budget-${index}`, slug: `byte-budget-${index}`, name: '界'.repeat(100), nameAr: 'ع'.repeat(100), country: '界'.repeat(100), crest: 'https://upload.wikimedia.org/' + 'a'.repeat(700) });
    const result = store.toggle(favorite);
    if (result.error) { assert.equal(result.error, 'size'); assert.equal(storage.raw(), lastDocument); break; }
    lastDocument = storage.raw();
  }
  const count = store.getSnapshot().preferences.favorites.length;
  assert.ok(count > 0 && count < 60);
  assert.ok(new TextEncoder().encode(storage.raw()).byteLength <= MAX_PREFERENCES_BYTES);
  assert.equal(decodePreferences(storage.raw()).state, 'ok');
  assert.equal(store.setDashboardEnabled(false).persisted, true);
  assert.equal(decodePreferences(storage.raw()).value.favorites.length, count);
  assert.equal(decodePreferences(storage.raw()).value.dashboardEnabled, false);
  assert.equal(safeFavoriteCrest('https://upload.wikimedia.org/' + '界'.repeat(300)), null);
});

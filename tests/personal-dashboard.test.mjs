import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDashboardSelection, selectionForPreferences, utcDatesForLocalDay,
  buildDashboard, isDashboardResponse, snapshotIsStale,
} from '../src/features/personalization/lib/dashboard.ts';
import { TIMEZONE_CHOICES, isValidTimeZone } from '../src/lib/pure/time.ts';

// Synthetic match snapshots are confined to tests; never shipped as football data.
const NOW = Date.parse('2026-10-01T19:00:00Z');
const selection = { teams: [{ id: 'team:arsenal-eng', providerId: 'fd~57' }], leagues: [] };
const match = (overrides = {}) => ({
  id: 'fd~990001', provider: 'fd', providerId: '990001', utcDate: '2026-10-01T18:00:00Z',
  status: 'scheduled', minute: null,
  home: { id: 'fd~57', name: 'Isolated home', shortName: null, crest: null },
  away: { id: 'fd~999', name: 'Isolated away', shortName: null, crest: null },
  score: { home: null, away: null }, league: { id: 'fd~PL', code: 'PL', name: 'Test competition', emblem: null, country: null },
  matchday: null, venue: null, referee: null, events: [], lastUpdated: '2026-10-01T19:00:00Z', ...overrides,
});
const result = (data, overrides = {}) => ({ data, source: 'fd', stale: false, fetchedAt: '2026-10-01T19:00:00Z', ...overrides });
const build = (overrides = {}) => buildDashboard({ day: '2026-10-01', timeZone: 'Africa/Cairo', now: NOW, selection, daily: [result([]), result([])], live: result([]), news: null, newsEnabled: false, entityIdForTeam: (id) => id === 'fd~57' ? 'team:arsenal-eng' : null, ...overrides });

test('dashboard input accepts only bounded catalogue references, not arbitrary provider queries', () => {
  assert.deepEqual(parseDashboardSelection(selection), selection);
  assert.equal(parseDashboardSelection({ teams: [{ id: 'team:../admin', providerId: null }], leagues: [] }), null);
  assert.equal(parseDashboardSelection({ teams: [{ id: 'team:arsenal-eng', providerId: 'fd~57~extra' }], leagues: [] }), null);
  assert.equal(parseDashboardSelection({ teams: [], leagues: ['INVENTED'] }), null);
  assert.equal(parseDashboardSelection({ teams: [], leagues: Array(61).fill('PL') }), null);
  const deduped = parseDashboardSelection({ teams: [...selection.teams, ...selection.teams], leagues: ['PL', 'PL'] });
  assert.equal(deduped.teams.length, 1); assert.deepEqual(deduped.leagues, ['PL']);
});

test('preferences send IDs only, exclude player follows, and create a stable sorted key', () => {
  const selected = selectionForPreferences({ favorites: [
    { kind: 'player', id: 'player:fd~101', name: 'Ignored player', teamId: 'fd~57' },
    { kind: 'league', leagueCode: 'EGY' }, { kind: 'team', id: 'team:z', providerId: null, name: 'Not sent' },
    { kind: 'team', id: 'team:a', providerId: 'fd~57', name: 'Not sent' },
  ] });
  assert.deepEqual(selected, { teams: [{ id: 'team:a', providerId: 'fd~57' }, { id: 'team:z', providerId: null }], leagues: ['EGY'] });
  assert.equal(JSON.stringify(selected).includes('Not sent'), false);
});

test('UTC buckets cover Cairo, negative offsets, fractions, DST and date boundaries', () => {
  assert.deepEqual(utcDatesForLocalDay('2026-10-01', 'Africa/Cairo'), ['2026-09-30', '2026-10-01']);
  assert.deepEqual(utcDatesForLocalDay('2026-10-01', 'America/New_York'), ['2026-10-01', '2026-10-02']);
  assert.deepEqual(utcDatesForLocalDay('2026-10-01', 'Asia/Kolkata'), ['2026-09-30', '2026-10-01']);
  assert.deepEqual(utcDatesForLocalDay('2026-01-01', 'Pacific/Auckland'), ['2025-12-31', '2026-01-01']);
  assert.deepEqual(utcDatesForLocalDay('2026-11-01', 'America/New_York'), ['2026-11-01', '2026-11-02']);
  assert.deepEqual(utcDatesForLocalDay('2026-01-01', 'UTC'), ['2026-01-01']);
  assert.deepEqual(utcDatesForLocalDay('2026-03-29', 'Europe/London'), ['2026-03-28', '2026-03-29']);
  assert.ok(TIMEZONE_CHOICES.every((choice) => isValidTimeZone(choice.id)));
});

test('team filters use actual refs/entities, not a same-name opponent', () => {
  const sameNameDifferentTeam = match({ id: 'fd~990002', home: { id: 'fd~998', name: 'Isolated home', crest: null }, away: { id: 'fd~997', name: 'Other', crest: null } });
  const data = build({ daily: [result([match(), sameNameDifferentTeam])] });
  assert.equal(data.fixtures.length, 1);
  const entityOnly = build({ selection: { teams: [{ id: 'team:arsenal-eng', providerId: null }], leagues: [] }, daily: [result([match()])] });
  assert.equal(entityOnly.fixtures.length, 1);
});

test('competition follows match only the requested existing competition', () => {
  const pd = match({ id: 'fd~990002', league: { code: 'PD', name: 'Other competition' } });
  const data = build({ selection: { teams: [], leagues: ['PL'] }, daily: [result([match(), pd])] });
  assert.equal(data.fixtures.length, 1);
});

test('a local-day boundary includes previous UTC night and excludes next local day', () => {
  const localToday = match({ utcDate: '2026-09-30T22:30:00Z' });
  const nextDay = match({ id: 'fd~990002', utcDate: '2026-10-01T22:30:00Z' });
  assert.equal(build({ daily: [result([localToday, nextDay])] }).fixtures.length, 1);
  const ny = build({ timeZone: 'America/New_York', daily: [result([match({ utcDate: '2026-10-02T02:30:00Z' })])] });
  assert.equal(ny.fixtures.length, 1);
});

test('live, scheduled and confirmed finished records are separated without inventing scores', () => {
  const scheduled = match();
  const live = match({ id: 'fd~990002', status: 'live', minute: 45, score: { home: 1, away: 0 } });
  const finished = match({ id: 'fd~990003', status: 'finished', score: { home: 2, away: 1 } });
  const data = build({ daily: [result([scheduled, live, finished])] });
  assert.equal(data.live.length, 1); assert.equal(data.fixtures.length, 1); assert.equal(data.results.length, 1);
  assert.equal(data.fixtures[0].match.score.home, null);
  assert.equal(isDashboardResponse(data), true);
});

test('newer snapshots deduplicate the same match and retain genuine source timestamps', () => {
  const older = match({ status: 'live', minute: 30, score: { home: 0, away: 0 }, lastUpdated: '2026-10-01T18:58:00Z' });
  const newer = match({ status: 'live', minute: 32, score: { home: 1, away: 0 } });
  const data = build({ daily: [result([older], { fetchedAt: '2026-10-01T18:58:00Z' })], live: result([newer]) });
  assert.equal(data.live.length, 1); assert.equal(data.live[0].match.score.home, 1);
  assert.equal(data.live[0].fetchedAt, '2026-10-01T19:00:00Z');
  assert.equal(data.fetchedAt, '2026-10-01T18:58:00Z');
});

test('outages remain partial/unavailable, never a fabricated complete empty schedule', () => {
  assert.equal(build({ daily: [null, result([])] }).coverage, 'partial');
  assert.equal(build({ daily: [null, null], live: null }).coverage, 'unavailable');
  assert.equal(build({ daily: [null, null], live: null }).fetchedAt, null);
  assert.equal(build({ daily: [result([]), result([])] }).coverage, 'complete');
});

test('news is linked by proven entity IDs and keeps original credits and URLs', () => {
  const entry = { id: 'test-news', title: 'Isolated headline', url: 'https://example.com/article', source: 'Test-only publisher', sourceUrl: 'https://example.com', publishedAt: '2026-10-01T18:50:00Z', excerpt: '', entities: [{ id: 'team:arsenal-eng', name: 'Arsenal' }] };
  const other = { ...entry, id: 'other', entities: [{ id: 'team:another', name: 'Arsenal' }] };
  const data = build({ newsEnabled: true, news: result([entry, other]) });
  assert.equal(data.news.length, 1); assert.equal(data.news[0].url, entry.url); assert.equal(data.news[0].source, entry.source);
  assert.equal(data.newsStatus, 'available');
  assert.equal(build().newsStatus, 'disabled');
  assert.equal(build({ newsEnabled: true }).newsStatus, 'unavailable');
});

test('old, stale, offline and stuck-live snapshots cannot be presented as fresh', () => {
  const row = { match: match({ status: 'live', minute: 30, score: { home: 0, away: 0 } }), stale: false, fetchedAt: '2026-10-01T19:00:00Z', source: 'fd' };
  assert.equal(snapshotIsStale(row, NOW, true), false);
  assert.equal(snapshotIsStale(row, NOW + 61_000, true), true);
  assert.equal(snapshotIsStale(row, NOW, false), true);
  assert.equal(snapshotIsStale({ ...row, stale: true }, NOW, true), true);
  const stuck = build({ live: result([match({ status: 'live', score: { home: 0, away: 0 }, lastUpdated: '2026-10-01T18:30:00Z' })]) });
  assert.equal(stuck.live[0].stale, true);
});

test('HTTP 200 schema validation rejects missing/malformed scores, snapshots and outbound scripts', () => {
  assert.equal(isDashboardResponse({}), false);
  const data = build({ daily: [result([match()])] });
  assert.equal(isDashboardResponse(data), true);
  const corrupt = structuredClone(data); corrupt.fixtures[0].match.score = undefined;
  assert.equal(isDashboardResponse(corrupt), false);
  const negative = structuredClone(data); negative.fixtures[0].match.score.home = -1;
  assert.equal(isDashboardResponse(negative), false);
  const image = structuredClone(data); image.fixtures[0].match.home.crest = 'javascript:alert(1)';
  assert.equal(isDashboardResponse(image), false);
  assert.equal(isDashboardResponse({ ...data, news: [{ id: 'bad', title: 'Bad', url: 'javascript:alert(1)', sourceUrl: 'https://example.com', source: 'Test', excerpt: '', publishedAt: null }] }), false);
});

test('large followed match sets are bounded without truncating original source payloads', () => {
  const matches = Array.from({ length: 100 }, (_, index) => match({ id: `fd~${990000 + index}` }));
  const data = build({ daily: [result(matches)] });
  assert.equal(data.fixtures.length, 8);
  assert.equal(matches.length, 100);
});

test('runtime guards reject impossible days, route traversal, malformed card props and over-limit groups', () => {
  const data = build({ daily: [result([match()])] });
  assert.equal(isDashboardResponse({ ...data, day: '2026-02-31' }), false);
  const route = structuredClone(data); route.fixtures[0].match.id = '../../profile';
  assert.equal(isDashboardResponse(route), false);
  const number = structuredClone(data); number.fixtures[0].match.matchday = { invalid: true };
  assert.equal(isDashboardResponse(number), false);
  const image = structuredClone(data); image.fixtures[0].match.league.emblem = { invalid: true };
  assert.equal(isDashboardResponse(image), false);
  assert.equal(isDashboardResponse({ ...data, live: Array(7).fill(data.fixtures[0]) }), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { serveShareImage } from '../src/features/share-cards/lib/image-http.ts';

// Dependency injection is test-only; the production route always owns provider IO.
const data = { source: 'fd', stale: false, fetchedAt: '2026-10-02T18:45:00Z', data: {
  id: 'fd~990001', provider: 'fd', providerId: '990001', utcDate: '2026-10-02T19:00:00Z', status: 'live', minute: 70,
  home: { id: 'fd~1', name: 'Isolated home', shortName: null, crest: null }, away: { id: 'fd~2', name: 'Isolated away', shortName: null, crest: null },
  score: { home: 4, away: 2 }, league: { id: 'fd~PL', name: 'Isolated league', code: 'PL', country: null, emblem: null },
  events: [], lastUpdated: '2026-10-02T18:45:00Z', matchday: null, venue: null, referee: null,
} };
const params = { locale: 'ar', id: data.data.id };
const req = (query = '', headers = {}) => new Request(`https://site.test/ar/matches/${params.id}/share-image${query}`, { headers });
const deps = (overrides = {}) => ({ getMatch: async () => data, render: async () => new Uint8Array([137, 80, 78, 71]), limit: () => ({ ok: true, retryAfterSeconds: 0 }), ...overrides });

test('bad IDs/locales fail before limiter, provider or renderer', async () => {
  const fail = () => { assert.fail('invalid input caused IO'); };
  const dependency = deps({ getMatch: fail, render: fail, limit: fail });
  assert.equal((await serveShareImage(req(), { ...params, id: 'https://evil.test' }, dependency)).status, 404);
  assert.equal((await serveShareImage(req(), { ...params, locale: 'xx' }, dependency)).status, 404);
});
test('query source/score/template URLs and free text are rejected without upstream calls', async () => {
  const response = await serveShareImage(req('?home=evil&source=http://127.0.0.1'), params, deps({ getMatch: () => { assert.fail('query caused IO'); } }));
  assert.equal(response.status, 400); assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('a public PNG has source snapshot/short bounded cache/noindex/nosniff headers', async () => {
  let providerCalls = 0, renders = 0;
  const response = await serveShareImage(req(), params, deps({ getMatch: async id => { assert.equal(id, params.id); providerCalls++; return data; }, render: async model => { assert.equal(model.home.score, 4); renders++; return new Uint8Array([1, 2, 3]); } }));
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/png');
  assert.match(response.headers.get('cache-control'), /s-maxage=30/); assert.match(response.headers.get('x-robots-tag'), /noindex/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert.equal(response.headers.get('x-kora-snapshot-at'), '2026-10-02T18:45:00.000Z');
  assert.deepEqual([providerCalls, renders], [1, 1]);
});
test('finished snapshots get bounded longer caching; stale snapshots remain no-store', async () => {
  const finished = { ...data, data: { ...data.data, status: 'finished' } };
  assert.match((await serveShareImage(req(), params, deps({ getMatch: async () => finished }))).headers.get('cache-control'), /s-maxage=300/);
  assert.equal((await serveShareImage(req(), params, deps({ getMatch: async () => ({ ...data, stale: true }) }))).headers.get('cache-control'), 'no-store');
});
test('unavailable matches return honest404, not a fictional successful score image', async () => {
  const response = await serveShareImage(req(), params, deps({ getMatch: async () => null, render: () => { assert.fail('rendered missing match'); } }));
  assert.equal(response.status, 404); assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('upstream and render errors are generic503 with retry, not leaked provider secrets', async () => {
  for (const broken of [{ getMatch: async () => { throw new Error('API_TOKEN=secret'); } }, { render: async () => { throw new Error('font failure: private path'); } }]) {
    let logs = 0; const response = await serveShareImage(req(), params, deps({ ...broken, onUnavailable: () => logs++ }));
    assert.equal(response.status, 503); assert.equal(response.headers.get('retry-after'), '30');
    assert.equal(await response.text(), '{"error":"image_unavailable"}'); assert.equal(logs, 1);
  }
});
test('abuse limits fail before upstream IO and do not cache429', async () => {
  const response = await serveShareImage(req(), params, deps({ limit: () => ({ ok: false, retryAfterSeconds: 22 }), getMatch: () => { assert.fail('limited upstream call'); } }));
  assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '22'); assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('oversized/empty render buffers fail closed instead of exhausting caches', async () => {
  for (const bytes of [new Uint8Array(), new Uint8Array(512001)]) assert.equal((await serveShareImage(req(), params, deps({ render: async () => bytes }))).status, 503);
});
test('public OG rendering ignores preference/locale/timezone cookies and remains deterministic', async () => {
  const models = [];
  const dependency = deps({ render: async model => { models.push(model); return new Uint8Array([1]); } });
  await serveShareImage(req('', { cookie: 'KORA_TZ=Africa/Cairo; NEXT_LOCALE=en' }), params, dependency);
  await serveShareImage(req('', { cookie: 'KORA_TZ=America/New_York; NEXT_LOCALE=ar' }), params, dependency);
  assert.deepEqual(models[0], models[1]); assert.equal(models[0].locale, 'ar'); assert.equal(models[0].kickoff, '2026-10-02 19:00 UTC');
});

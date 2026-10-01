import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { emptyCatalog, liveCatalogSchema, liveMatchSchema, streamSchema, reportSchema } from '../src/features/live/types/index.ts';
import { hasMatchCoverage, playableStreams } from '../src/features/live/lib/catalog.ts';

export const fixture = () => ({
  matchId: 'fd~42', home: { id: 'fd~1', name: 'Home', crest: null }, away: { id: 'fd~2', name: 'Away', crest: null },
  competition: { id: 'PL', code: 'PL', name: 'Test competition' },
  startsAt: '2026-10-01T18:00:00Z', endsAt: null, status: 'live',
});
export const source = (id = 'one', priority = 1) => streamSchema.parse({
  id, matchId: 'fd~42', label: 'Official test source', provider: 'youtube', sourceRef: 'abcdefghijk', channelId: 'UCabcdefghijklmnopqrstuv', priority,
  language: 'ar', quality: 'HD', region: [], isOfficial: true,
  rights: { basis: 'official', referenceUrl: 'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv', verifiedAt: '2026-10-01T00:00:00Z', verifiedBy: 'Test only' },
  status: 'live', startsAt: '2026-10-01T18:00:00Z', endsAt: null, reportCount: 0,
});

test('shipped live catalog is empty and valid; no fabricated broadcasts', async () => {
  const catalog = liveCatalogSchema.parse(JSON.parse(await readFile(new URL('../public/live/catalog.json', import.meta.url), 'utf8')));
  assert.deepEqual(catalog, emptyCatalog());
});
test('requires rights evidence even when isOfficial is true', () => {
  const stream = source(); delete stream.rights;
  assert.equal(streamSchema.safeParse(stream).success, false);
  assert.equal(streamSchema.safeParse({ ...source(), isOfficial: false }).success, false);
  assert.equal(streamSchema.safeParse({ ...source(), isOfficial: false, rights: { ...source().rights, basis: 'licensed' } }).success, true);
});
test('rejects arbitrary embeds, unapproved HLS, unsafe links and disguised hosts', () => {
  for (const url of ['javascript:alert(1)', 'http://www.scorebat.com/embed/g/1/', 'https://www.scorebat.com.evil.example/embed/g/1/', 'https://user:password@www.scorebat.com/embed/g/1/', 'https://www.scorebat.com:8443/embed/g/1/', 'https://127.0.0.1/a.m3u8']) {
    assert.equal(streamSchema.safeParse({ ...source(), provider: 'iframe', sourceRef: url }).success, false, url);
  }
  assert.equal(streamSchema.safeParse({ ...source(), provider: 'hls', sourceRef: 'https://unlicensed.example/a.m3u8' }).success, false);
  assert.equal(streamSchema.safeParse({ ...source(), provider: 'youtube', sourceRef: 'https://www.youtube.com/watch?v=abcdefghijk' }).success, false);
});
test('licensed Scorebat embeds are URL-only, never raw publisher HTML', () => {
  assert.equal(streamSchema.safeParse({ ...source(), provider: 'highlights', embedProvider: 'scorebat', sourceRef: 'https://www.scorebat.com/embed/g/abc123/', status: 'ended' }).success, true);
  assert.equal(streamSchema.safeParse({ ...source(), provider: 'highlights', embedProvider: 'scorebat', sourceRef: '<iframe src="https://www.scorebat.com/embed/g/abc123/"></iframe>' }).success, false);
});
test('catalog enforces unique IDs, foreign match refs, chronology and distinct teams', () => {
  const catalog = { ...emptyCatalog(), matches: [fixture()], streams: [source()] };
  assert.equal(liveCatalogSchema.safeParse(catalog).success, true);
  assert.equal(liveCatalogSchema.safeParse({ ...catalog, streams: [source(), source()] }).success, false);
  assert.equal(liveCatalogSchema.safeParse({ ...catalog, streams: [{ ...source(), matchId: 'fd~unknown' }] }).success, false);
  assert.equal(liveMatchSchema.safeParse({ ...fixture(), away: fixture().home }).success, false);
  assert.equal(liveMatchSchema.safeParse({ ...fixture(), endsAt: '2026-09-30T18:00:00Z' }).success, false);
  assert.equal(reportSchema.safeParse({ matchId: '../../admin', streamId: 'one' }).success, false);
});
test('elapsed kickoffs never invent live streams; hidden and failed sources are excluded', () => {
  const now = Date.parse('2026-10-01T19:00:00Z');
  const match = fixture();
  const catalog = { ...emptyCatalog(), matches: [match], streams: [source()] };
  assert.equal(playableStreams(catalog, match, now).length, 1);
  for (const change of [{ status: 'failed' }, { status: 'scheduled' }, { hiddenUntil: '2026-10-01T19:15:00Z' }, { endsAt: '2026-10-01T18:55:00Z' }]) {
    assert.equal(playableStreams({ ...catalog, streams: [{ ...source(), ...change }] }, match, now).length, 0);
  }
  assert.equal(hasMatchCoverage(catalog, match.matchId, now), true);
  const ended = { ...match, status: 'ended' };
  assert.equal(playableStreams(catalog, ended, now).length, 0);
});

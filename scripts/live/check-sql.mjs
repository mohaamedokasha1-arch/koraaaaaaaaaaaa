/**
 * Optional PostgreSQL-WASM regression check. PGlite is NOT an application dependency.
 * Point LIVE_PGLITE_MODULE at a temporary @electric-sql/pglite/dist/index.js install.
 * This creates an in-memory DB only and never connects to your real Supabase.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { emptyCatalog, liveCatalogSchema, streamSchema } from '../../src/features/live/types/index.ts';

if (!process.env.LIVE_PGLITE_MODULE) throw new Error('Set LIVE_PGLITE_MODULE to an optional temporary PGlite module (see docs/live/README.md).');
const { PGlite } = await import(process.env.LIVE_PGLITE_MODULE);
const db = new PGlite();
const fixture = {
  ...emptyCatalog(),
  matches: [{ matchId: 'test~db', home: { id: 'test~home', name: 'Test home', crest: null }, away: { id: 'test~away', name: 'Test away', crest: null }, competition: { id: 'TEST', name: 'Synthetic DB test', code: null }, startsAt: '2026-10-01T18:00:00Z', endsAt: null, status: 'live' }],
  streams: [streamSchema.parse({ id: 'test-stream', matchId: 'test~db', label: 'Synthetic DB fixture', provider: 'youtube', sourceRef: 'testVideo01', channelId: 'UCabcdefghijklmnopqrstuv', priority: 1, language: 'en', quality: 'HD', region: [], isOfficial: true, rights: { basis: 'official', referenceUrl: 'https://www.youtube.com/', verifiedAt: '2026-10-01T00:00:00Z', verifiedBy: 'Test only' }, status: 'live', startsAt: '2026-10-01T18:00:00Z' })],
};
const read = async () => liveCatalogSchema.parse((await db.query("select document from public.live_catalog where id='primary'")).rows[0].document);
const save = async (document) => (await db.query('select public.save_live_catalog($1::jsonb) as result', [JSON.stringify(document)])).rows[0].result;
const report = async (hash, stream = 'test-stream') => (await db.query('select public.record_live_report($1, $2, $3) as result', ['test~db', stream, hash])).rows[0].result;
const hash = (index) => index.toString(16).padStart(64, '0');
let checks = 0;
try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  const sql = await readFile(new URL('../../docs/live/supabase.sql', import.meta.url), 'utf8');
  await db.exec(sql); await db.exec(sql); checks++; // migration is re-runnable
  await db.exec('set role anon');
  assert.deepEqual(await read(), emptyCatalog()); checks++;
  await assert.rejects(db.query("update public.live_catalog set document='{}'::jsonb"), /permission denied/); checks++;
  await assert.rejects(db.query('select * from public.live_reports'), /permission denied/); checks++;
  await assert.rejects(report(hash(1)), /permission denied/); checks++;
  await assert.rejects(db.query("select public.consume_live_limit('bad', 5, 600)"), /permission denied/); checks++;
  await db.exec('reset role; set role service_role');
  const published = await save(fixture); assert.equal(published.revision, 1); checks++;
  assert.equal((await report(hash(1))).outcome, 'accepted'); checks++;
  assert.equal((await report(hash(1))).outcome, 'duplicate');
  assert.equal((await read()).streams[0].reportCount, 1); checks++;
  assert.equal((await report(hash(1), 'unknown')).outcome, 'unknown_stream'); checks++;
  for (let index = 0; index < 3; index++) assert.equal((await report(hash(1))).outcome, 'duplicate');
  assert.equal((await report(hash(1))).outcome, 'rate_limited'); checks++;
  for (let index = 2; index <= 5; index++) assert.equal((await report(hash(index))).outcome, 'accepted');
  const reported = await read(); assert.equal(reported.streams[0].reportCount, 5);
  assert.ok(Date.parse(reported.streams[0].hiddenUntil) > Date.now()); checks++;
  assert.equal(reported.revision, 1, 'reports do not change the curation revision'); checks++;
  assert.ok(!JSON.stringify(reported).includes(hash(1)), 'public catalogue contains no reporter identities'); checks++;
  const edit = { ...fixture, revision: 1 }; assert.equal((await save(edit)).revision, 2);
  const after = await read(); assert.equal(after.streams[0].reportCount, 5); assert.equal(after.streams[0].hiddenUntil, reported.streams[0].hiddenUntil); checks++;
  await assert.rejects(save(edit), /revision conflict/); checks++;
  await db.exec('reset role');
  await db.exec("update public.live_reports set created_at=now()-interval '2 days'; update public.live_limits set reset_at=now()-interval '2 days'");
  await db.exec('set role service_role');
  assert.equal((await report(hash(1))).outcome, 'accepted'); checks++;
  assert.equal((await db.query('select count(*)::integer as count from public.live_reports')).rows[0].count, 1); checks++;
  for (let index = 0; index < 96; index++) {
    const result = await db.query("select public.consume_live_limit('youtube:day:test',96,86400) as result"); assert.equal(result.rows[0].result.allowed, true);
  }
  assert.equal((await db.query("select public.consume_live_limit('youtube:day:test',96,86400) as result")).rows[0].result.allowed, false); checks++;
  await assert.rejects(save({}), /Invalid catalogue/); checks++;
  const next = { ...(await read()), streams: [{ ...fixture.streams[0], sourceRef: 'nextVideo01' }] };
  await save(next); const replaced = await read(); assert.equal(replaced.streams[0].reportCount, 0); assert.equal(replaced.streams[0].hiddenUntil, null);
  assert.equal((await db.query('select count(*)::integer as count from public.live_reports')).rows[0].count, 0); checks++;
  assert.equal((await report(hash(6))).outcome, 'accepted'); assert.equal((await read()).streams[0].hiddenUntil, null); checks++;
  const pending = await read(); const competing = await Promise.allSettled([save(pending), save(pending)]);
  assert.equal(competing.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(competing.filter((result) => result.status === 'rejected').length, 1); checks++;
  const removed = { ...(await read()), streams: [] }; await save(removed);
  assert.equal((await db.query('select count(*)::integer as count from public.live_reports')).rows[0].count, 0); checks++;
  console.log(`PostgreSQL checks passed: ${checks} (migration, RLS, RPC permissions, dedup, shared limits, auto-hide, revision conflict, retention, daily quota).`);
} finally { await db.close(); }

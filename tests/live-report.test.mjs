import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLiveReport } from '../src/features/live/lib/report-handler.ts';
import { anonymousHash, readSmallJson, sameOriginRequest } from '../src/features/live/lib/http.ts';

const env = { enabled: true, url: 'https://project.supabase.co', serviceRole: 'test-service-role', salt: 'test-only-salt-with-more-than-32-characters', siteUrl: 'https://site.example' };
function request(body = { matchId: 'fd~42', streamId: 'one' }, headers = {}) {
  return new Request('https://site.example/api/live/report', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://site.example', 'x-real-ip': '192.0.2.1', ...headers }, body: JSON.stringify(body) });
}
const reply = (outcome, retry_after = 0) => async () => Response.json({ outcome, retry_after });

test('disabled feature, cross-origin and unconfigured store never write reports', async () => {
  const fetcher = async () => { throw new Error('must never be called'); };
  assert.equal((await handleLiveReport(request(), { ...env, enabled: false }, fetcher)).status, 404);
  assert.equal((await handleLiveReport(request({}, { origin: 'https://evil.example' }), env, fetcher)).status, 403);
  assert.equal((await handleLiveReport(request(), { ...env, salt: undefined }, fetcher)).status, 503);
});
test('rejects unknown fields, bad IDs, malformed JSON and oversized chunked requests', async () => {
  assert.equal((await handleLiveReport(request({ matchId: '../admin', streamId: 'one' }), env)).status, 400);
  assert.equal((await handleLiveReport(request({ matchId: 'fd~42', streamId: 'one', url: 'https://evil.example' }), env)).status, 400);
  assert.equal((await handleLiveReport(request({ text: 'x'.repeat(1100) }), env)).status, 413);
  const chunked = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(1100))); controller.close(); } });
  const streamed = new Request('https://site.example', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: chunked, duplex: 'half' });
  await assert.rejects(readSmallJson(streamed), (error) => error.status === 413);
});
test('uses one atomic RPC, hashes identity and returns a truthful success', async () => {
  let calls = 0;
  const response = await handleLiveReport(request(), env, async (url, init) => {
    calls++; assert.equal(url, 'https://project.supabase.co/rest/v1/rpc/record_live_report');
    const payload = JSON.parse(init.body);
    assert.equal(payload.p_stream_id, 'one'); assert.equal(payload.p_match_id, 'fd~42');
    assert.match(payload.p_reporter_hash, /^[a-f0-9]{64}$/); assert.ok(!init.body.includes('192.0.2.1'));
    assert.equal(init.headers.Authorization, 'Bearer test-service-role');
    return Response.json({ outcome: 'accepted' });
  });
  assert.equal(calls, 1); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { accepted: true, duplicate: false });
});
test('durable duplicates, rate limit, unknown source and outage are distinct', async () => {
  assert.equal((await handleLiveReport(request(), env, reply('duplicate'))).status, 200);
  const rate = await handleLiveReport(request(), env, reply('rate_limited', 42));
  assert.equal(rate.status, 429); assert.equal(rate.headers.get('retry-after'), '42');
  assert.equal((await handleLiveReport(request(), env, reply('unknown_stream'))).status, 404);
  assert.equal((await handleLiveReport(request(), env, async () => { throw new Error('offline'); })).status, 503);
  assert.equal((await handleLiveReport(request(), env, async () => Response.json({ unexpected: true }))).status, 503);
});
test('hashes are stable for deduplication, salted and never raw IPs', async () => {
  const first = await anonymousHash('192.0.2.1', env.salt);
  assert.equal(first, await anonymousHash('192.0.2.1', env.salt));
  assert.notEqual(first, await anonymousHash('192.0.2.1', 'another test salt'));
});
test('origin check accepts actual preview host but rejects suffix tricks and opaque origins', () => {
  assert.equal(sameOriginRequest(new Request('http://internal:3000/api/live/report', { headers: { host: '3000-preview.e2b.app', origin: 'https://3000-preview.e2b.app' } })), true);
  assert.equal(sameOriginRequest(request({}, { origin: 'https://site.example.evil.test' })), false);
  assert.equal(sameOriginRequest(request({}, { origin: 'null' })), false);
});
test('direct callers cannot spoof distinct reporter identities with proxy headers', async () => {
  const { requestIdentity } = await import('../src/features/live/lib/http.ts');
  const headers = new Headers({ 'x-real-ip': '192.0.2.10', 'x-forwarded-for': '192.0.2.11', 'x-vercel-forwarded-for': '192.0.2.12' });
  assert.equal(requestIdentity(headers, false, false), 'unknown');
  assert.equal(requestIdentity(headers, true, false), '192.0.2.10');
  assert.equal(requestIdentity(headers, false, true), '192.0.2.12');
});

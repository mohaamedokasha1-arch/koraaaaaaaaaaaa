import test from 'node:test';
import assert from 'node:assert/strict';
import { readBoundedJson, sameOriginRequest } from '../src/features/personalization/lib/http.ts';

const req = (body, headers = {}) => new Request('https://3000-preview.e2b.app/api/personalization/dashboard', { method: 'POST', body, headers: { 'Content-Type': 'application/json', ...headers } });

test('JSON accepts the exact media type with charset and validates malformed bodies', async () => {
  assert.deepEqual(await readBoundedJson(req('{"teams":[]}', { 'Content-Type': 'application/json; charset=utf-8' })), { teams: [] });
  await assert.rejects(readBoundedJson(req('{bad')), /invalid_json/);
  await assert.rejects(readBoundedJson(req('{}', { 'Content-Type': 'application/jsonx' })), /unsupported_content_type/);
  await assert.rejects(readBoundedJson(req('{}', { 'Content-Type': 'text/plain' })), /unsupported_content_type/);
});

test('declared and actual byte limits block oversized requests before provider calls', async () => {
  await assert.rejects(readBoundedJson(req('{}', { 'Content-Length': '20000' })), /payload_too_large/);
  await assert.rejects(readBoundedJson(req(' '.repeat(17_000))), /payload_too_large/);
  await assert.rejects(readBoundedJson(req('"' + 'ع'.repeat(9000) + '"')), /payload_too_large/);
});

test('chunked streams enforce a running byte ceiling and release the reader', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(9000)); controller.enqueue(new Uint8Array(9000)); },
    cancel() { cancelled = true; },
  });
  const request = new Request('https://example.com/api', { method: 'POST', body: stream, duplex: 'half', headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(readBoundedJson(request), /payload_too_large/);
  assert.equal(cancelled, true); assert.equal(request.body.locked, false);
});

test('invalid UTF-8 fails closed instead of replacing bytes in entity references', async () => {
  const request = req(new Uint8Array([0x22, 0xff, 0x22]));
  await assert.rejects(readBoundedJson(request), /invalid_json/);
});

test('same-origin reads work on the preview host; cross-site origins fail closed', () => {
  assert.equal(sameOriginRequest(req('{}', { Origin: 'https://3000-preview.e2b.app' })), true);
  assert.equal(sameOriginRequest(req('{}', { Origin: 'https://evil.example' })), false);
  assert.equal(sameOriginRequest(req('{}', { Origin: 'null' })), false);
  assert.equal(sameOriginRequest(req('{}', { 'Sec-Fetch-Site': 'cross-site' })), false);
  assert.equal(sameOriginRequest(req('{}')), true); // read-only CLI/API, no cookies granting permissions
});

test('Node URL normalisation preserves browser and HTTPS preview same-origin requests', () => {
  const nodeRequest = (headers) => new Request('http://localhost:3000/api/personalization/dashboard', { method: 'POST', body: '{}', headers });
  assert.equal(sameOriginRequest(nodeRequest({ Host: '127.0.0.1:3000', Origin: 'http://127.0.0.1:3000' })), true);
  const preview = { Host: '3000-preview.e2b.app', Origin: 'https://3000-preview.e2b.app', 'X-Forwarded-Proto': 'https' };
  assert.equal(sameOriginRequest(nodeRequest(preview)), true);
  assert.equal(sameOriginRequest(nodeRequest({ ...preview, Host: '3000-preview.e2b.app:443' })), true);
  assert.equal(sameOriginRequest(nodeRequest({ ...preview, Origin: 'https://evil.example', 'X-Forwarded-Host': 'evil.example' })), false);
  assert.equal(sameOriginRequest(nodeRequest({ ...preview, Origin: 'http://3000-preview.e2b.app' })), false);
  assert.equal(sameOriginRequest(nodeRequest({ ...preview, 'X-Forwarded-Proto': 'file' })), false);
});

test('Origin must be an HTTP(S) origin rather than credentials, paths or a URL wrapper', () => {
  for (const Origin of ['https://user@3000-preview.e2b.app', 'https://3000-preview.e2b.app/path', 'blob:https://3000-preview.e2b.app/abc', 'https://3000-preview.e2b.app?query=1']) assert.equal(sameOriginRequest(req('{}', { Origin })), false);
});

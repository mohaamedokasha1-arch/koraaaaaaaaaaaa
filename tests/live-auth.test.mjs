import test from 'node:test';
import assert from 'node:assert/strict';
import { comparePassword, signAdminSession, verifyAdminSession } from '../src/features/live/lib/auth-crypto.ts';
import { catalogChannelIssues } from '../src/features/live/lib/whitelist.ts';

const now = Date.parse('2026-10-01T12:00:00Z');
const secret = 'a-long-test-only-password-not-for-production';
test('session is signed, expires in eight hours and rotating password invalidates it', async () => {
  const token = await signAdminSession(secret, now);
  assert.equal(await verifyAdminSession(token, secret, now), true);
  assert.equal(await verifyAdminSession(token, secret, now + 8 * 60 * 60 * 1000), false);
  assert.equal(await verifyAdminSession(token, 'another-password', now), false);
  assert.equal(await verifyAdminSession(`${token}x`, secret, now), false);
  assert.equal(await verifyAdminSession(token.replace(/^./, 'x'), secret, now), false);
  assert.equal(await verifyAdminSession('x'.repeat(2000), secret, now), false);
});
test('password comparison is exact and compares fixed-size digests', async () => {
  assert.equal(await comparePassword(secret, secret), true);
  assert.equal(await comparePassword('incorrect', secret), false);
  assert.equal(await comparePassword('', secret), false);
});
test('YouTube catalog publishing is gated by the enabled official channel whitelist', () => {
  const catalog = { streams: [{ provider: 'youtube', channelId: 'UCtest', id: 'one' }] };
  assert.equal(catalogChannelIssues(catalog, []).length, 1);
  assert.equal(catalogChannelIssues(catalog, [{ id: 'UCtest', enabled: false }]).length, 1);
  assert.equal(catalogChannelIssues(catalog, [{ id: 'UCtest', enabled: true }]).length, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';

process.env.CIRCUIT_BREAKER_THRESHOLD = '3';
process.env.CIRCUIT_BREAKER_COOLDOWN_MS = '60';

const { allowRequest, recordFailure, recordSuccess, getHealth } = await import('../src/lib/circuit.ts');

/**
 * Circuit breaker (Phase 5 of the platform spec): after N consecutive failures
 * the source is short-circuited for a cooldown, then probed again. These tests
 * pin the exact behaviour the failure scenarios in the report rely on.
 */

test('a healthy provider starts closed and allows requests', () => {
  assert.equal(allowRequest('fd'), true);
  const health = getHealth().find((h) => h.providerId === 'fd');
  assert.equal(health.state, 'closed');
  assert.equal(health.consecutiveFailures, 0);
});

test('consecutive failures open the circuit and block calls', () => {
  recordFailure('af', 'network');
  recordFailure('af', 'network');
  assert.equal(allowRequest('af'), true, 'two failures are below the threshold of 3');

  recordFailure('af', 'timeout');
  assert.equal(allowRequest('af'), false, 'third consecutive failure must open the circuit');

  const health = getHealth().find((h) => h.providerId === 'af');
  assert.equal(health.state, 'open');
  assert.equal(health.totalFailures, 3);
  assert.equal(health.lastError, 'timeout');
  assert.ok(health.openedUntil > Date.now());
});

test('a success resets the failure streak and closes a half-open circuit', () => {
  const before = getHealth().find((h) => h.providerId === 'af');
  assert.equal(before.consecutiveFailures, 3);

  void before;
  recordSuccess('af', 120);
  const after = getHealth().find((h) => h.providerId === 'af');
  assert.equal(after.consecutiveFailures, 0);
  assert.equal(after.state, 'closed');
  assert.equal(after.totalSuccesses, 1);
  assert.equal(after.avgLatencyMs, 120);
});

test('after the cooldown the circuit half-opens and probes again', async () => {
  recordFailure('espn', 'boom');
  recordFailure('espn', 'boom');
  recordFailure('espn', 'boom');
  assert.equal(allowRequest('espn'), false);

  await new Promise((r) => setTimeout(r, 80));
  assert.equal(allowRequest('espn'), true, 'cooldown elapsed → probe allowed again');
  const health = getHealth().find((h) => h.providerId === 'espn');
  assert.equal(health.state, 'half-open');
});

test('latency average is a real average, not the last value', () => {
  recordSuccess('tsdb', 100);
  recordSuccess('tsdb', 200);
  recordSuccess('tsdb', 300);
  const health = getHealth().find((h) => h.providerId === 'tsdb');
  assert.equal(health.avgLatencyMs, 200);
  assert.equal(health.totalSuccesses, 3);
});

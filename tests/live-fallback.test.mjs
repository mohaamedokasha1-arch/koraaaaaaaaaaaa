import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackReducer, initialFallback, attemptToken, orderStreams } from '../src/features/live/lib/fallback.ts';

// Synthetic adapter fixtures are never part of the public catalog.
const stream = (id, priority = 1) => ({ id, priority, sourceRef: 'abcdefghijk', provider: 'youtube' });
const started = (...streams) => fallbackReducer(initialFallback(streams), { type: 'start', preferredId: null });
const fail = (state) => fallbackReducer(state, { type: 'fail', token: attemptToken(state) });

test('priority is primary and last actual success breaks equal-priority ties', () => {
  assert.deepEqual(orderStreams([stream('a', 2), stream('b', 1), stream('c', 1)], 'c').map((s) => s.id), ['c', 'b', 'a']);
});
test('nothing plays until start; failure advances, attempts are bounded to two per source', () => {
  assert.equal(initialFallback([stream('a')]).phase, 'idle');
  let state = started(stream('a'), stream('b'));
  assert.equal(state.currentId, 'a');
  state = fail(state); assert.equal(state.currentId, 'b');
  state = fail(state); assert.equal(state.currentId, 'a');
  state = fail(state); assert.equal(state.currentId, 'b');
  state = fail(state);
  assert.equal(state.phase, 'exhausted');
  assert.deepEqual(state.attempts, { a: 2, b: 2 });
  assert.deepEqual(fail(state), state);
});
test('late events from unmounted adapters cannot fail or confirm the current stream', () => {
  const old = started(stream('a'), stream('b'));
  const next = fail(old);
  for (const type of ['fail', 'working', 'loaded', 'slow']) assert.deepEqual(fallbackReducer(next, { type, token: attemptToken(old) }), next);
});
test('an iframe load leaves health unknown; playback and buffering provide real health', () => {
  let state = started(stream('a'));
  state = fallbackReducer(state, { type: 'loaded', token: attemptToken(state) });
  assert.equal(state.phase, 'ready');
  assert.equal(state.health.a, 'unknown');
  state = fallbackReducer(state, { type: 'working', token: attemptToken(state) });
  assert.equal(state.health.a, 'working');
  state = fallbackReducer(state, { type: 'slow', token: attemptToken(state) });
  assert.equal(state.health.a, 'slow');
});
test('manual selection respects the cap and explicit retry resets it', () => {
  let state = started(stream('a'), stream('b'));
  for (let i = 0; i < 4; i++) state = fail(state);
  assert.deepEqual(fallbackReducer(state, { type: 'select', id: 'b' }), state);
  const retry = fallbackReducer(state, { type: 'retry' });
  assert.equal(retry.phase, 'loading');
  // Zero counters are explicit so even object-property IDs cannot inherit a value.
  assert.deepEqual(retry.attempts, { a: 1, b: 0 });
  assert.notEqual(attemptToken(retry), attemptToken(state));
});
test('withdrawn/reported source switches without reloading unchanged sources', () => {
  const state = started(stream('a'), stream('b'));
  const same = fallbackReducer(state, { type: 'sync', streams: [stream('a'), stream('b')] });
  assert.equal(attemptToken(same), attemptToken(state));
  const removed = fallbackReducer(state, { type: 'sync', streams: [stream('b')] });
  assert.equal(removed.currentId, 'b');
  assert.equal(removed.phase, 'loading');
});
test('zero sources and all withdrawn sources end honestly, without loops', () => {
  assert.equal(started().phase, 'exhausted');
  const state = started(stream('a'));
  assert.equal(fallbackReducer(state, { type: 'sync', streams: [] }).phase, 'exhausted');
});
test('opaque object-property IDs cannot bypass the maximum attempt limit', () => {
  const ids = ['__proto__', 'constructor', 'hasOwnProperty'];
  let state = started(...ids.map((id) => stream(id)));
  for (let index = 0; index < 6; index++) state = fail(state);
  assert.equal(state.phase, 'exhausted');
  for (const id of ids) assert.equal(state.attempts[id], 2);
  assert.equal(Object.getPrototypeOf(state.attempts), Object.prototype);
});
test('sync seeds safe counters for a newly discovered opaque ID even if the active source stays', () => {
  let state = started(stream('a'));
  state = fallbackReducer(state, { type: 'sync', streams: [stream('a'), stream('constructor')] });
  assert.equal(state.attempts.constructor, 0); assert.equal(state.health.constructor, 'unknown');
  state = fallbackReducer(state, { type: 'next' }); assert.equal(state.attempts.constructor, 1);
  for (let index = 0; index < 3; index++) state = fail(state);
  assert.equal(state.phase, 'exhausted');
});

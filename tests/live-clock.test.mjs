import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisibleClock } from '../src/features/live/lib/clock.ts';

function setup() {
  let now = 1000;
  let visible = true;
  const timers = new Set();
  const visibilityListeners = new Set();
  const clock = createVisibleClock({
    now: () => now,
    isVisible: () => visible,
    every: (callback, intervalMs) => {
      assert.equal(intervalMs, 30_000);
      timers.add(callback);
      return () => timers.delete(callback);
    },
    onVisibilityChange: (callback) => {
      visibilityListeners.add(callback);
      return () => visibilityListeners.delete(callback);
    },
  }, 30_000);
  return {
    clock, timers, visibilityListeners,
    advance: (value) => { now = value; for (const tick of timers) tick(); },
    visibility: (value) => { visible = value; for (const sync of visibilityListeners) sync(); },
  };
}

test('a hundred cards share one clock timer and visibility listener; the last unsubscribe cleans up', () => {
  const { clock, timers, visibilityListeners, advance } = setup();
  assert.equal(clock.getSnapshot(), null, 'no clock access during SSR/import');
  const subscriptions = Array.from({ length: 100 }, () => clock.subscribe(() => {}));
  assert.equal(timers.size, 1);
  assert.equal(visibilityListeners.size, 1);
  advance(31_000); assert.equal(clock.getSnapshot(), 31_000);
  for (const unsubscribe of subscriptions.slice(0, -1)) unsubscribe();
  assert.equal(timers.size, 1);
  subscriptions.at(-1)();
  assert.equal(timers.size, 0);
  assert.equal(visibilityListeners.size, 0);
});

test('hidden clocks have no timer; showing the tab immediately refreshes elapsed time', () => {
  const { clock, timers, advance, visibility } = setup();
  let updates = 0;
  const unsubscribe = clock.subscribe(() => updates++);
  assert.equal(clock.getSnapshot(), 1000);
  visibility(false);
  assert.equal(timers.size, 0);
  advance(180_000);
  assert.equal(clock.getSnapshot(), 1000);
  assert.equal(updates, 1);
  visibility(true);
  assert.equal(clock.getSnapshot(), 180_000);
  assert.equal(timers.size, 1);
  assert.equal(updates, 2);
  unsubscribe();
});

test('initial hidden subscriptions wait; duplicate subscriptions and strict-mode remounts are safe', () => {
  const { clock, timers, visibilityListeners, visibility, advance } = setup();
  visibility(false);
  const callback = () => {};
  const first = clock.subscribe(callback);
  const second = clock.subscribe(callback);
  assert.equal(clock.getSnapshot(), null);
  assert.equal(timers.size, 0);
  first(); first();
  assert.equal(visibilityListeners.size, 1, 'the other subscription still owns the listener');
  second();
  assert.equal(visibilityListeners.size, 0);
  advance(120_000);
  const remounted = clock.subscribe(callback);
  visibility(true);
  assert.equal(clock.getSnapshot(), 120_000);
  assert.equal(timers.size, 1);
  remounted();
});

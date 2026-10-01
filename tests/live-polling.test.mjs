import test from 'node:test';
import assert from 'node:assert/strict';
import { pauseLiveRefresh, retryLiveRequest } from '../src/features/live/lib/polling.ts';

function retryFixture() {
  let visible = true;
  let online = true;
  let retries = 0;
  const config = {
    isVisible: () => visible,
    isOnline: () => online,
    isPaused: () => !visible || !online,
    errorRetryCount: 2,
    errorRetryInterval: 45_000,
  };
  return {
    retry: (retryCount = 1) => retryLiveRequest(new Error('offline'), 'live-test', config, (options) => {
      assert.equal(options.dedupe, true);
      retries++;
    }, { retryCount, dedupe: true }),
    hide: () => { visible = false; },
    show: () => { visible = true; },
    offline: () => { online = false; },
    retries: () => retries,
  };
}

test('scheduled retries recheck hidden/offline state at execution time', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const hidden = retryFixture(); hidden.retry(); hidden.hide();
  const offline = retryFixture(); offline.retry(); offline.offline();
  context.mock.timers.tick(45_000);
  assert.equal(hidden.retries(), 0);
  assert.equal(offline.retries(), 0);
  hidden.show(); hidden.retry(); context.mock.timers.tick(45_000);
  assert.equal(hidden.retries(), 1);
});

test('retries are bounded and never scheduled when the request is already paused', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const paused = retryFixture(); paused.hide(); paused.retry(); paused.show();
  const capped = retryFixture(); capped.retry(3);
  const allowed = retryFixture(); allowed.retry(2);
  context.mock.timers.tick(45_000);
  assert.equal(paused.retries(), 0);
  assert.equal(capped.retries(), 0);
  assert.equal(allowed.retries(), 1);
});

test('pause guard is SSR-safe and includes browser visibility and connectivity', (context) => {
  assert.equal(pauseLiveRefresh(), false);
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  context.after(() => {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
    else delete globalThis.navigator;
  });
  const document = { visibilityState: 'hidden' };
  const navigator = { onLine: true };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigator });
  assert.equal(pauseLiveRefresh(), true);
  document.visibilityState = 'visible'; navigator.onLine = false;
  assert.equal(pauseLiveRefresh(), true);
  navigator.onLine = true;
  assert.equal(pauseLiveRefresh(), false);
});

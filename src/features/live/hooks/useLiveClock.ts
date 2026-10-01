'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { createVisibleClock, type ClockEnvironment } from '../lib/clock.ts';

// Browser globals are accessed only on subscription, never during SSR/render.
const environment: ClockEnvironment = {
  now: () => Date.now(),
  isVisible: () => document.visibilityState === 'visible',
  every: (tick, intervalMs) => {
    const timer = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(timer);
  },
  onVisibilityChange: (sync) => {
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  },
};
const availabilityClock = createVisibleClock(environment, 30_000);
const countdownClock = createVisibleClock(environment, 1000);

/** Stable hydration; suppression/end times advance even with unchanged JSON. */
export function useLiveClock(initialNow: number | null = null, cadence: 'availability' | 'countdown' = 'availability') {
  const clock = cadence === 'countdown' ? countdownClock : availabilityClock;
  const serverSnapshot = useCallback(() => initialNow, [initialNow]);
  return useSyncExternalStore(clock.subscribe, clock.getSnapshot, serverSnapshot);
}

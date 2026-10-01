/** A small external store: one timer/listener per cadence, not per match card. */
export interface ClockEnvironment {
  now: () => number;
  isVisible: () => boolean;
  every: (tick: () => void, intervalMs: number) => () => void;
  onVisibilityChange: (sync: () => void) => () => void;
}

export function createVisibleClock(environment: ClockEnvironment, intervalMs: number) {
  let snapshot: number | null = null;
  let stopTimer: (() => void) | null = null;
  let stopListening: (() => void) | null = null;
  const listeners = new Set<() => void>();

  function tick() {
    if (!environment.isVisible()) return;
    const now = environment.now();
    if (snapshot === now) return;
    snapshot = now;
    for (const listener of listeners) listener();
  }
  function sync() {
    stopTimer?.();
    stopTimer = null;
    if (!environment.isVisible()) return;
    tick();
    if (listeners.size) stopTimer = environment.every(tick, intervalMs);
  }
  function subscribe(listener: () => void) {
    // A subscription is unique even if a caller reuses the same callback.
    const notify = () => listener();
    listeners.add(notify);
    if (listeners.size === 1) {
      stopListening = environment.onVisibilityChange(sync);
      sync();
    }
    return () => {
      if (!listeners.delete(notify) || listeners.size) return;
      stopTimer?.();
      stopListening?.();
      stopTimer = stopListening = null;
    };
  }
  return { subscribe, getSnapshot: () => snapshot };
}

'use client';

import { useSyncExternalStore } from 'react';
import { PREFERENCES_KEY } from '../lib/preferences';
import { createPreferencesStore } from '../lib/store';

// No browser access at module load or on the server; no request/global user state.
export const preferencesStore = createPreferencesStore(() =>
  typeof window === 'undefined' ? null : window.localStorage,
);
let subscribers = 0;
function onStorage(event: StorageEvent) {
  if (event.key === PREFERENCES_KEY || event.key === null) preferencesStore.refresh();
}
function subscribe(listener: () => void) {
  const previous = preferencesStore.getSnapshot();
  if (subscribers === 0 && previous.ready && previous.persistence !== 'memory') preferencesStore.refresh();
  const unsubscribe = preferencesStore.subscribe(listener);
  if (subscribers++ === 0) window.addEventListener('storage', onStorage);
  return () => {
    unsubscribe();
    if (--subscribers === 0) window.removeEventListener('storage', onStorage);
  };
}
export function usePreferences() {
  return useSyncExternalStore(subscribe, preferencesStore.getSnapshot, preferencesStore.getServerSnapshot);
}

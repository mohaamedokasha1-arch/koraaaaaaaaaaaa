import {
  PREFERENCES_KEY, decodePreferences, defaultPreferences, encodePreferences, toggleFavorite,
  type Preferences, type PreferenceError,
} from './preferences.ts';

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export interface PreferencesSnapshot {
  preferences: Preferences;
  ready: boolean;
  persistence: 'loading' | 'stored' | 'memory' | 'repaired' | 'unsupported';
}
export interface PreferenceMutation { error?: PreferenceError; persisted: boolean }

const SERVER_SNAPSHOT: PreferencesSnapshot = {
  preferences: defaultPreferences(), ready: false, persistence: 'loading',
};

/** IO-injected, bounded store. Blocked/quota-full storage stays honest and usable. */
export function createPreferencesStore(storageAccessor: () => PreferenceStorage | null) {
  let snapshot = SERVER_SNAPSHOT;
  let initialized = false;
  const listeners = new Set<() => void>();

  function emit() { for (const listener of listeners) listener(); }
  function read(): void {
    try {
      const storage = storageAccessor();
      if (!storage) throw new Error('storage unavailable');
      const decoded = decodePreferences(storage.getItem(PREFERENCES_KEY));
      snapshot = {
        preferences: decoded.value, ready: true,
        persistence: decoded.state === 'ok' ? 'stored' : decoded.state,
      };
    } catch {
      snapshot = { ...snapshot, ready: true, persistence: 'memory' };
    }
  }
  function initialize() {
    if (initialized) return;
    initialized = true;
    read();
  }
  function prepareMutation(): PreferenceMutation | null {
    initialize();
    // Read the latest committed document, reducing lost changes between tabs.
    // localStorage has no cross-tab transaction/CAS: simultaneous writes remain
    // last-write-wins, not a substitute for account synchronisation.
    if (snapshot.persistence !== 'memory') read();
    return snapshot.persistence === 'unsupported' ? { error: 'unsupported', persisted: false } : null;
  }
  function write(preferences: Preferences): PreferenceMutation {
    const encoded = encodePreferences(preferences);
    if (encoded === null) { emit(); return { error: 'size', persisted: snapshot.persistence === 'stored' }; }
    let persisted = false;
    try {
      const storage = storageAccessor();
      if (storage) {
        storage.setItem(PREFERENCES_KEY, encoded);
        persisted = true;
      }
    } catch { /* preference remains in memory, never claim durable success */ }
    snapshot = { preferences, ready: true, persistence: persisted ? 'stored' : 'memory' };
    emit();
    return { persisted };
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SERVER_SNAPSHOT,
    subscribe(listener: () => void) {
      initialize();
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    /** Called only for the relevant browser storage event, never during render. */
    refresh() {
      initialized = true;
      read();
      emit();
    },
    toggle(input: unknown): PreferenceMutation {
      const blocked = prepareMutation();
      if (blocked) { emit(); return blocked; }
      const next = toggleFavorite(snapshot.preferences, input);
      if (next.error) { emit(); return { error: next.error, persisted: snapshot.persistence === 'stored' }; }
      return write(next.value);
    },
    setDashboardEnabled(enabled: boolean): PreferenceMutation {
      const blocked = prepareMutation();
      if (blocked) { emit(); return blocked; }
      if (typeof enabled !== 'boolean') return { error: 'invalid', persisted: false };
      return write({ ...snapshot.preferences, dashboardEnabled: enabled });
    },
    /** Explicit reset may remove a future-version document; normal writes may not. */
    clear(): PreferenceMutation {
      initialized = true;
      let persisted = false;
      try {
        const storage = storageAccessor();
        if (storage) { storage.removeItem(PREFERENCES_KEY); persisted = true; }
      } catch { /* report memory-only reset */ }
      snapshot = { preferences: defaultPreferences(), ready: true, persistence: persisted ? 'stored' : 'memory' };
      emit();
      return { persisted };
    },
  };
}

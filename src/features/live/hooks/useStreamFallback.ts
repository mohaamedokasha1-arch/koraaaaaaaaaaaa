'use client';

import { useCallback, useEffect, useMemo, useReducer } from 'react';
import type { Stream } from '../types/index.ts';
import { attemptToken, fallbackReducer, initialFallback } from '../lib/fallback.ts';

const storageKey = (matchId: string) => `kora:live:last-success:${matchId}`;

export function useStreamFallback(matchId: string, streams: Stream[]) {
  const [state, dispatch] = useReducer(fallbackReducer, streams, initialFallback);
  useEffect(() => { dispatch({ type: 'sync', streams }); }, [streams]);
  useEffect(() => {
    let preferredId: string | null = null;
    try { preferredId = localStorage.getItem(storageKey(matchId)); } catch { /* blocked/private storage is fine */ }
    dispatch({ type: 'start', preferredId });
  }, [matchId]);

  const token = attemptToken(state);
  const events = useMemo(() => ({
    onLoaded: () => dispatch({ type: 'loaded', token }),
    onWorking: () => dispatch({ type: 'working', token }),
    onSlow: () => dispatch({ type: 'slow', token }),
    onFailure: () => dispatch({ type: 'fail', token }),
  }), [token]);
  useEffect(() => {
    if (!state.currentId || state.health[state.currentId] !== 'working') return;
    try { localStorage.setItem(storageKey(matchId), state.currentId); } catch { /* optional preference only */ }
  }, [matchId, state.currentId, state.health]);

  const select = useCallback((id: string) => dispatch({ type: 'select', id }), []);
  const next = useCallback(() => dispatch({ type: 'next' }), []);
  const retry = useCallback(() => dispatch({ type: 'retry' }), []);
  return { state, current: state.streams.find((stream) => stream.id === state.currentId) ?? null, token, events, select, next, retry };
}

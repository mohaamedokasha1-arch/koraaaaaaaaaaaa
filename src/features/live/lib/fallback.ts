import type { Stream } from '../types/index.ts';
import { MAX_STREAM_ATTEMPTS } from './config.ts';

export type StreamHealth = 'unknown' | 'loading' | 'working' | 'slow' | 'failed';
export interface FallbackState {
  streams: Stream[];
  currentId: string | null;
  attempts: Record<string, number>;
  health: Record<string, StreamHealth>;
  phase: 'idle' | 'loading' | 'ready' | 'exhausted';
  generation: number;
  preferredId: string | null;
  switched: boolean;
}
export type FallbackAction =
  | { type: 'start'; preferredId: string | null }
  | { type: 'select'; id: string }
  | { type: 'next' }
  | { type: 'fail' | 'working' | 'loaded' | 'slow'; token: string }
  | { type: 'retry' }
  | { type: 'sync'; streams: Stream[] };

export function orderStreams(streams: Stream[], preferredId: string | null = null): Stream[] {
  return [...streams].sort((a, b) => a.priority - b.priority || Number(b.id === preferredId) - Number(a.id === preferredId) || a.id.localeCompare(b.id));
}

export function initialFallback(streams: Stream[]): FallbackState {
  const ordered = orderStreams(streams);
  return { streams: ordered, currentId: ordered[0]?.id ?? null, attempts: Object.fromEntries(ordered.map((stream) => [stream.id, 0])), health: Object.fromEntries(ordered.map((stream) => [stream.id, 'unknown' as const])), phase: 'idle', generation: 0, preferredId: null, switched: false };
}

export function attemptToken(state: FallbackState): string { return `${state.generation}:${state.currentId ?? ''}`; }

function enter(state: FallbackState, id: string, switched: boolean): FallbackState {
  return { ...state, currentId: id, phase: 'loading', generation: state.generation + 1, switched, attempts: { ...state.attempts, [id]: (state.attempts[id] ?? 0) + 1 }, health: { ...state.health, [id]: 'loading' } };
}

function advance(state: FallbackState): FallbackState {
  const index = state.streams.findIndex((stream) => stream.id === state.currentId);
  const queue = [...state.streams.slice(index + 1), ...state.streams.slice(0, index + 1)];
  const next = queue.find((stream) => (state.attempts[stream.id] ?? 0) < MAX_STREAM_ATTEMPTS);
  return next ? enter(state, next.id, true) : { ...state, phase: 'exhausted', switched: false, generation: state.generation + 1 };
}

/** Pure bounded state machine. Old/unmounted adapter events cannot switch a new attempt. */
export function fallbackReducer(state: FallbackState, action: FallbackAction): FallbackState {
  if (action.type === 'sync') {
    const streams = orderStreams(action.streams, state.preferredId);
    const current = streams.find((stream) => stream.id === state.currentId);
    const old = state.streams.find((stream) => stream.id === state.currentId);
    const sameSource = (stream: Stream) => state.streams.some((previous) => previous.id === stream.id && previous.sourceRef === stream.sourceRef && previous.provider === stream.provider);
    const nextState = { ...state, streams,
      attempts: Object.fromEntries(streams.map((stream) => [stream.id, sameSource(stream) && Object.hasOwn(state.attempts, stream.id) ? state.attempts[stream.id] : 0])),
      health: Object.fromEntries(streams.map((stream) => [stream.id, sameSource(stream) && Object.hasOwn(state.health, stream.id) ? state.health[stream.id] : 'unknown' as const])),
    };
    if (current && current.sourceRef === old?.sourceRef && current.provider === old.provider) return nextState;
    if (state.phase === 'idle') return { ...nextState, currentId: streams[0]?.id ?? null };
    if (state.phase === 'exhausted') return nextState;
    return advance(nextState);
  }
  if (action.type === 'retry') {
    const reset = { ...initialFallback(state.streams), preferredId: state.preferredId, generation: state.generation };
    const first = orderStreams(reset.streams, state.preferredId)[0];
    return first ? enter(reset, first.id, false) : { ...reset, phase: 'exhausted' };
  }
  if (action.type === 'start') {
    if (state.phase !== 'idle') return state;
    const streams = orderStreams(state.streams, action.preferredId);
    const first = streams[0];
    const ready = { ...state, streams, preferredId: action.preferredId };
    return first ? enter(ready, first.id, false) : { ...ready, phase: 'exhausted' };
  }
  if (action.type === 'select') {
    if (!state.streams.some((stream) => stream.id === action.id) || (state.attempts[action.id] ?? 0) >= MAX_STREAM_ATTEMPTS) return state;
    if (state.currentId === action.id && state.phase !== 'exhausted') return state;
    return enter(state, action.id, true);
  }
  if (action.type === 'next') return state.phase === 'idle' || state.phase === 'exhausted' ? state : advance(state);
  if (action.token !== attemptToken(state) || state.phase === 'idle' || state.phase === 'exhausted' || !state.currentId) return state;
  if (action.type === 'fail') return advance({ ...state, health: { ...state.health, [state.currentId]: 'failed' } });
  if (action.type === 'loaded') return { ...state, phase: 'ready', health: { ...state.health, [state.currentId]: state.health[state.currentId] === 'loading' ? 'unknown' : state.health[state.currentId] } }; // iframe load is NOT proof of playback
  return { ...state, phase: 'ready', health: { ...state.health, [state.currentId]: action.type } };
}

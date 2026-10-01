'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { array as zArray, boolean as zBoolean, enum as zEnum, number as zNumber, object as zObject, string as zString } from 'zod';
import type { z } from 'zod';
import { LIVE_ENABLED, LIVE_POLL_MS } from '../lib/config.ts';
import { pauseLiveRefresh, retryLiveRequest } from '../lib/polling.ts';

const team = zObject({ id: zString(), name: zString() });
const scoreMatch = zObject({
  id: zString(), status: zEnum(['scheduled', 'live', 'halftime', 'finished', 'postponed', 'cancelled']),
  minute: zNumber().int().min(0).max(180).nullable(),
  home: team, away: team,
  score: zObject({ home: zNumber().int().min(0).max(40).nullable(), away: zNumber().int().min(0).max(40).nullable() }),
  events: zArray(zObject({
    type: zEnum(['goal', 'own_goal', 'penalty_goal', 'yellow', 'red', 'yellow_red', 'sub']),
    minute: zNumber().nullable(), extraMinute: zNumber().nullable(), teamId: zString().nullable(),
    player: zString().nullable(), assist: zString().nullable(), playerOut: zString().nullable(), playerIn: zString().nullable(),
  })).max(300),
});
const responseSchema = zObject({ matches: zArray(scoreMatch).max(2000), stale: zBoolean(), fetchedAt: zString().datetime({ offset: true }) });
export type LiveScore = z.infer<typeof scoreMatch>;

async function fetchScores(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error('Scores unavailable');
  return responseSchema.parse(await response.json());
}

/** Read the existing scores endpoint only; no provider file is modified. */
export function useLiveScores(matchId: string, enabled: boolean) {
  const { data, error, mutate } = useSWR(LIVE_ENABLED && enabled ? '/api/matches/live' : null, fetchScores, {
    refreshInterval: LIVE_POLL_MS,
    isPaused: pauseLiveRefresh,
    onErrorRetry: retryLiveRequest,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 15_000,
    errorRetryCount: 1,
    errorRetryInterval: LIVE_POLL_MS,
    keepPreviousData: true,
  });
  useEffect(() => {
    const visible = () => { if (LIVE_ENABLED && enabled && !pauseLiveRefresh()) void mutate(); };
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, [enabled, mutate]);
  const current = data?.matches.find((match) => match.id === matchId) ?? null;
  const [lastKnown, setLastKnown] = useState<LiveScore | null>(null);
  useEffect(() => { if (current) setLastKnown(current); }, [current]);
  const score = current ?? (lastKnown?.id === matchId ? lastKnown : null);
  return { score, stale: Boolean(error) || Boolean(data?.stale) || Boolean(score && !current) || Boolean(score && !enabled && score.status !== 'finished') };
}

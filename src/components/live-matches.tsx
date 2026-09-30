'use client';

import useSWR from 'swr';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import type { UnifiedMatch } from '@/lib/types';
import { MatchCard } from './match-card';
import { EmptyState, StaleNotice } from './empty-state';

interface LiveResponse {
  matches: UnifiedMatch[];
  stale: boolean;
  fetchedAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`live fetch ${r.status}`);
  return r.json() as Promise<LiveResponse>;
});

function agoSeconds(fromIso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(fromIso).getTime()) / 1000));
}

/**
 * Live matches block with 30s polling + "last updated" indicator.
 * Server passes initial data for instant first paint; SWR keeps it fresh.
 * Polling pauses automatically when the tab is hidden.
 */
export function LiveMatches({
  initial,
  locale,
  dict,
}: {
  initial: LiveResponse | null;
  locale: Locale;
  dict: Dictionary;
}) {
  const { data, mutate, isValidating } = useSWR<LiveResponse>('/api/matches/live', fetcher, {
    fallbackData: initial ?? undefined,
    refreshInterval: 30_000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
  const [, forceTick] = useState(0);

  // re-render every 5s so the "x seconds ago" label stays honest
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const matches = data?.matches ?? initial?.matches ?? [];
  const fetchedAt = data?.fetchedAt ?? initial?.fetchedAt;
  const stale = (data?.stale ?? initial?.stale) || false;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="section-title flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          {dict.home.liveNow}
          <span className="rounded-md bg-navy-700/80 px-2 py-0.5 text-xs font-bold text-slate-200 tabular-nums ring-1 ring-inset ring-navy-600/60">
            {matches.length}
          </span>
        </h2>
        <div className="ms-auto flex items-center gap-2 text-xs text-slate-500">
          {fetchedAt && (
            <span>
              {dict.common.lastUpdated}:{' '}
              {agoSeconds(fetchedAt) < 60
                ? dict.common.secondsAgo.replace('{n}', String(agoSeconds(fetchedAt)))
                : dict.common.minuteAgo.replace('{n}', String(Math.floor(agoSeconds(fetchedAt) / 60)))}
            </span>
          )}
          <button
            type="button"
            onClick={() => mutate()}
            disabled={isValidating}
            className="inline-flex items-center gap-1 rounded-md border border-navy-600 bg-navy-800/60 px-2 py-1.5 font-medium text-slate-300 transition-colors hover:border-navy-400/60 hover:bg-navy-800 hover:text-white disabled:opacity-50 min-h-[32px]"
            aria-label={dict.common.refresh}
          >
            <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${isValidating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" strokeLinecap="round" />
              <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {dict.common.refresh}
          </button>
        </div>
      </div>

      {stale && <div className="mb-3"><StaleNotice message={dict.common.cachedNotice} /></div>}

      {matches.length === 0 ? (
        <EmptyState title={dict.common.emptyLive} body={dict.common.emptyLiveBody} />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} locale={locale} dict={dict} showLeague />
          ))}
        </div>
      )}
    </div>
  );
}

/** Small CTA used when a page wants to link into the live view. */
export function LiveLink({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <Link href={`/${locale}/live`} className="btn-primary">
      {dict.nav.live}
    </Link>
  );
}

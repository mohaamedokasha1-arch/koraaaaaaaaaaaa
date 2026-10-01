'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { MatchCard } from '@/components/match-card';
import { NewsAttribution, NewsList } from '@/components/news-list';
import { formatKickoffTime, num } from '@/lib/format';
import { localDayInZone, zoneLabel } from '@/lib/pure/time';
import { favoriteHref, favoriteLabel } from '../lib/preferences';
import { getPersonalCopy } from '../lib/copy';
import { isDashboardResponse, selectionForPreferences, snapshotIsStale, type DashboardResponse, type DashboardSelection } from '../lib/dashboard';
import { preferencesStore, usePreferences } from '../hooks/usePreferences';
import { StorageNotice } from './StorageNotice';

export interface DashboardLabels {
  common: Pick<Dictionary['common'], 'versus'>;
  match: Dictionary['match'];
  news: Pick<Dictionary['news'], 'readAtSource'>;
}
function subscribeOnline(listener: () => void) {
  window.addEventListener('online', listener); window.addEventListener('offline', listener);
  return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener); };
}
const onlineSnapshot = () => navigator.onLine;
const serverOnlineSnapshot = () => true;
async function fetchDashboard([url, selection]: [string, DashboardSelection, string, string]): Promise<DashboardResponse> {
  const response = await fetch(url, {
    method: 'POST', body: JSON.stringify(selection), headers: { 'Content-Type': 'application/json' },
    cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('dashboard_unavailable');
  const data: unknown = await response.json();
  if (!isDashboardResponse(data)) throw new Error('invalid_dashboard');
  return data;
}

export default function HomeDashboard({ locale, tz, labels }: { locale: Locale; tz: string; labels: DashboardLabels }) {
  const snapshot = usePreferences();
  const t = getPersonalCopy(locale);
  const online = useSyncExternalStore(subscribeOnline, onlineSnapshot, serverOnlineSnapshot);
  const [now, setNow] = useState(0);
  const [preferenceMessage, setPreferenceMessage] = useState('');
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const sync = () => setNow(Date.now());
    const visibility = () => {
      clearInterval(timer);
      if (!document.hidden) { sync(); timer = setInterval(sync, 30_000); }
    };
    visibility(); document.addEventListener('visibilitychange', visibility);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  const selection = selectionForPreferences(snapshot.preferences);
  const hasMatchInterests = selection.teams.length + selection.leagues.length > 0;
  const day = now ? localDayInZone(new Date(now).toISOString(), tz) : '';
  const { data, error, isLoading, isValidating, mutate } = useSWR<DashboardResponse>(
    hasMatchInterests && day ? ['/api/personalization/dashboard', selection, tz, day] : null,
    fetchDashboard,
    {
      refreshInterval: 60_000, dedupingInterval: 15_000, focusThrottleInterval: 60_000,
      refreshWhenHidden: false, refreshWhenOffline: false, shouldRetryOnError: false,
      revalidateOnReconnect: true,
      isPaused: () => document.hidden || !navigator.onLine,
    },
  );
  const groups = data ? [
    { title: t.live, entries: data.live }, { title: t.today, entries: data.fixtures }, { title: t.results, entries: data.results },
  ].filter((group) => group.entries.length > 0) : [];
  const date = data ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${data.day}T12:00:00Z`)) : null;
  const sources = data ? [...new Map(data.news.map((entry) => [entry.sourceUrl, { name: entry.source, url: entry.sourceUrl }])).values()] : [];

  return (
    <section className="card overflow-hidden" aria-labelledby="personal-dashboard-title" data-testid="personal-dashboard">
      <header className="relative flex flex-wrap items-center justify-between gap-4 border-b border-navy-700/60 px-5 py-5 sm:px-6">
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 hero-glow opacity-50" />
        <div className="relative">
          <p className="mb-2 text-[11px] font-semibold text-[#fbdf9b]">{t.localBadge}</p>
          <h2 id="personal-dashboard-title" className="section-title">{t.dashboard}</h2>
          <p className="mt-2 text-xs leading-6 text-slate-400">{t.dashboardIntro}</p>
        </div>
        <div className="relative flex flex-wrap gap-2">
          <Link href={`/${locale}/profile`} prefetch={false} className="btn-primary text-xs">{t.manage}</Link>
          <button type="button" className="btn-ghost text-xs" onClick={() => { const result = preferencesStore.setDashboardEnabled(false); if (result.error) setPreferenceMessage(t[result.error === 'unsupported' ? 'storageUnsupported' : result.error]); }}>{t.disable}</button>
        </div>
      </header>
      <div className="space-y-5 px-4 py-5 sm:px-6">
        <StorageNotice persistence={snapshot.persistence} locale={locale} />
        {preferenceMessage && <p role="status" className="text-xs leading-6 text-amber-200">{preferenceMessage}</p>}
        <nav aria-label={t.favorites} className="flex flex-wrap gap-2">
          {snapshot.preferences.favorites.slice(0, 6).map((favorite) => (
            <Link key={favorite.id} href={favoriteHref(favorite, locale)} prefetch={false} className="chip min-h-[36px] !px-3 hover:text-white">{favoriteLabel(favorite, locale)}</Link>
          ))}
          {snapshot.preferences.favorites.length > 6 && <Link href={`/${locale}/profile`} prefetch={false} className="chip min-h-[36px] !px-3">+{num(snapshot.preferences.favorites.length - 6, locale)}</Link>}
        </nav>
        {!online && <p role="status" className="rounded-lg border border-amber-400/25 bg-amber-400/5 p-3 text-sm leading-7 text-amber-200">{t.offline}</p>}
        {!hasMatchInterests && <p className="text-sm leading-7 text-slate-400">{t.playerOnly}</p>}
        {hasMatchInterests && !data && online && (isLoading || !day) && (
          <div role="status" aria-busy="true"><p className="mb-3 text-sm text-slate-400">{t.loadingDashboard}</p><div aria-hidden="true" className="grid gap-3 sm:grid-cols-2"><div className="h-24 animate-pulse rounded-xl bg-navy-800" /><div className="h-24 animate-pulse rounded-xl bg-navy-800" /></div></div>
        )}
        {hasMatchInterests && (error || (!data && !online)) && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/25 bg-amber-400/5 px-4 py-3">
            <p className="text-sm leading-7 text-amber-200">{data ? t.stale : t.unavailable}</p>
            <button type="button" className="btn-ghost text-xs disabled:opacity-40" disabled={!online || isValidating} onClick={() => void mutate()}>{t.retry}</button>
          </div>
        )}
        {data && (
          <>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
              <span>{date} · {zoneLabel(data.timeZone, locale)}</span>
              {data.fetchedAt && <span>{t.lastUpdated}: <time dateTime={data.fetchedAt}>{formatKickoffTime(data.fetchedAt, locale, tz)}</time></span>}
            </p>
            {(data.coverage !== 'complete' || !data.liveAvailable) && <p role="status" className="text-xs leading-6 text-amber-200">{t.partial}</p>}
            {groups.length === 0 && <p className="rounded-lg bg-navy-900/50 p-4 text-sm leading-7 text-slate-400">{t.noMatches}</p>}
            <div className={`grid gap-6 ${groups.length > 1 ? 'lg:grid-cols-2' : ''}`}>
              {groups.map((group) => (
                <section key={group.title} className="min-w-0">
                  <h3 className="mb-3 text-sm font-bold text-slate-200">{group.title}</h3>
                  <div className="space-y-3">
                    {group.entries.map((entry) => (
                      <div key={entry.match.id}>
                        <MatchCard match={entry.match} locale={locale} dict={labels} tz={tz} showLeague />
                        {(Boolean(error) || snapshotIsStale(entry, now, online)) && <p className="mt-1.5 text-[11px] leading-5 text-amber-200">{t.stale} <time dateTime={entry.fetchedAt}>{formatKickoffTime(entry.fetchedAt, locale, tz)}</time></p>}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <section className="space-y-3 border-t border-navy-700/60 pt-5" aria-label={t.news}>
              <h3 className="text-sm font-bold text-slate-200">{t.news}</h3>
              {(data.newsStale || !online || Boolean(error) || (data.newsFetchedAt !== null && now - Date.parse(data.newsFetchedAt) > 600_000)) && data.news.length > 0 && <p className="text-xs leading-6 text-amber-200">{t.stale}</p>}
              {data.news.length > 0 ? <><NewsList items={data.news} locale={locale} dict={labels} tz={tz} compact /><NewsAttribution sources={sources} locale={locale} /></> : <p className="text-xs leading-7 text-slate-400">{data.newsStatus === 'disabled' ? t.newsDisabled : data.newsStatus === 'unavailable' ? t.unavailable : t.newsEmpty}</p>}
            </section>
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-700/60 pt-4 text-xs">
          <span className="max-w-2xl leading-6 text-slate-500">{t.localOnly}</span>
          <Link href={`/${locale}/today`} prefetch={false} className="link-accent min-h-[36px] py-2 font-semibold">{t.allToday} ↗</Link>
        </div>
      </div>
    </section>
  );
}

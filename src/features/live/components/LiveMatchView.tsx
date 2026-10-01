'use client';

import Link from 'next/link';
import { zoneLabel } from '@/lib/pure/time';
import { useMemo } from 'react';
import type { Locale } from '@/i18n/locales';
import { TeamLogo } from '@/components/team-logo';
import type { LiveCatalog, LiveMatch } from '../types/index.ts';
import { getLiveCopy } from '../lib/copy.ts';
import { broadcastersForMatch, coverageStreams, playableStreams } from '../lib/catalog.ts';
import { useLiveCatalog } from '../hooks/useLiveCatalog';
import { useLiveClock } from '../hooks/useLiveClock';
import { useLiveScores } from '../hooks/useLiveScores';
import { useLiveTimezone } from '../hooks/useLiveTimezone';
import { Countdown } from './Countdown';
import { PlayerLoader } from './PlayerLoader';
import { WhereToWatch } from './WhereToWatch';
import { MatchTabs } from './MatchTabs';
import { LiveIcon } from './LiveIcon';

export function LiveMatchView({ initial, initialMatch, locale, renderedAt, initialStale }: {
  initial: LiveCatalog; initialMatch: LiveMatch; locale: Locale; renderedAt: number; initialStale: boolean;
}) {
  const { catalog, stale } = useLiveCatalog(initial, initialStale);
  const publishedMatch = catalog.matches.find((match) => match.matchId === initialMatch.matchId);
  const match = publishedMatch ?? initialMatch;
  const { score, stale: scoreStale } = useLiveScores(match.matchId, Boolean(publishedMatch) && match.status !== 'ended');
  const now = useLiveClock(renderedAt) ?? renderedAt;
  const available = useMemo(() => publishedMatch ? playableStreams(catalog, match, now) : [], [catalog, match, now, publishedMatch]);
  const broadcasters = useMemo(() => publishedMatch ? broadcastersForMatch(catalog, match) : [], [catalog, match, publishedMatch]);
  const external = useMemo(() => publishedMatch ? coverageStreams(catalog, match, now) : [], [catalog, match, now, publishedMatch]);
  const t = getLiveCopy(locale);
  const timeZone = useLiveTimezone();
  const status = match.status === 'ended' ? 'finished' : score?.status ?? match.status;
  const live = status === 'live' || status === 'halftime';
  const statusText = status === 'halftime' ? t.halftime : status === 'live' ? t.live : status === 'finished' ? t.statusEnded : status === 'postponed' ? t.postponed : status === 'cancelled' ? t.cancelled : t.statusScheduled;
  const title = `${match.home.name} × ${match.away.name}`;
  return <div className="space-y-6">
    <nav aria-label="breadcrumb" className="text-xs text-slate-400"><ol className="flex flex-wrap items-center gap-2"><li><Link href={`/${locale}`}>{t.home}</Link></li><li aria-hidden="true">/</li><li><Link href={`/${locale}/watch`}>{t.title}</Link></li><li aria-hidden="true">/</li><li aria-current="page" className="text-slate-200">{title}</li></ol></nav>
    {stale && <p role="status" className="text-sm text-amber-200">{t.stale}</p>}
    <header className="card relative overflow-hidden px-4 py-7 sm:px-8 sm:py-9"><div aria-hidden="true" className="pointer-events-none absolute inset-0 hero-glow" />
      <p className="relative mb-6 text-center text-xs text-slate-400">{match.competition.name} <span aria-hidden="true">·</span> <time dateTime={match.startsAt}>{new Date(match.startsAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', { timeZone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} {zoneLabel(timeZone, locale)}</time></p>
      <h1 className="sr-only">{title} · {t.title}</h1>
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <div className="flex min-w-0 flex-col items-center gap-3 text-center"><TeamLogo src={match.home.crest} alt={match.home.name} size={52} /><p className="text-sm font-bold text-white sm:text-lg">{score?.home.name ?? match.home.name}</p></div>
        <div className="flex flex-col items-center gap-2">
          <p className="score-pill text-2xl sm:text-4xl" dir="ltr"><span>{score?.score.home ?? '–'}</span><span className="text-slate-400">:</span><span>{score?.score.away ?? '–'}</span></p>
          <p className={`flex items-center gap-1.5 text-xs ${live ? 'text-red-300' : 'text-slate-400'}`}>{live && <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-red-400" aria-hidden="true" />}{statusText}{live && score?.minute !== null && score?.minute !== undefined ? ` · ${score.minute}′` : ''}</p>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-3 text-center"><TeamLogo src={match.away.crest} alt={match.away.name} size={52} /><p className="text-sm font-bold text-white sm:text-lg">{score?.away.name ?? match.away.name}</p></div>
      </div>
      {!score && <p className="relative mt-5 text-center text-xs text-slate-400">{t.scorePending}</p>}
      {scoreStale && <p role="status" className="relative mt-4 text-center text-xs text-amber-200">{t.scoreStale}</p>}
    </header>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-6">
        {status === 'scheduled' && <Countdown match={match} locale={locale} />}
        {available.length ? <PlayerLoader key={match.matchId} matchId={match.matchId} streams={available} broadcasters={broadcasters} externalStreams={external} title={title} locale={locale} /> : <div className="card flex aspect-video flex-col items-center justify-center gap-3 px-5 text-center"><LiveIcon name="tv" className="h-8 w-8 text-slate-400" /><h2 className="text-sm font-bold text-white sm:text-lg">{match.status === 'ended' ? t.highlights : t.noSource}</h2><p className="max-w-md text-xs leading-6 text-slate-400 sm:text-sm">{match.status === 'ended' ? t.finishedBody : t.noSourceBody}</p></div>}
        <MatchTabs match={match} score={score} locale={locale} />
      </div>
      <aside className="space-y-4 lg:sticky lg:top-24"><WhereToWatch broadcasters={broadcasters} externalStreams={external} locale={locale} /><div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4"><p className="flex items-center gap-2 text-xs font-semibold text-emerald-200"><LiveIcon name="shield" className="h-4 w-4" />{t.officialOnly}</p><p className="mt-2 text-xs leading-6 text-slate-400">{t.direct}</p></div></aside>
    </div>
  </div>;
}

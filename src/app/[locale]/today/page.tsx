import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { pageMetadata } from '@/lib/seo';
import { getMatchesByDate, localToday } from '@/lib/football';
import { MatchList } from '@/components/match-list';
import { ErrorState, StaleNotice } from '@/components/empty-state';
import { formatDayGroup } from '@/lib/format';
import type { UnifiedMatch } from '@/lib/types';
import { AutoRefresh } from '@/components/auto-refresh';
import { getUserTimeZone } from '@/lib/time';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    path: '/today',
    title: dict.seo.todayTitle,
    description: dict.seo.todayDesc,
  });
}

function Section({
  title,
  matches,
  locale,
  dict,
  tz,
  accent,
}: {
  title: string;
  matches: UnifiedMatch[];
  locale: Locale;
  dict: ReturnType<typeof getDictionary>;
  tz?: string;
  accent?: string;
}) {
  if (matches.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className={`section-title mb-3 ${accent ?? ''}`}>{title}</h2>
      <MatchList matches={matches} locale={locale} dict={dict} tz={tz} />
    </section>
  );
}

export default async function TodayPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const tz = await getUserTimeZone();
  const dict = getDictionary(locale);
  const today = localToday();

  let result = null;
  let failed = false;
  try {
    result = await getMatchesByDate(today);
  } catch {
    failed = true;
  }

  const live = result?.data.filter((m) => m.status === 'live' || m.status === 'halftime') ?? [];
  const upcoming = result?.data.filter((m) => m.status === 'scheduled') ?? [];
  const finished = result?.data.filter((m) => m.status === 'finished') ?? [];
  const other = result?.data.filter((m) => m.status === 'postponed' || m.status === 'cancelled') ?? [];
  const isEmpty = result && result.data.length === 0;

  return (
    <div className="container-page py-6 sm:py-8">
      <AutoRefresh intervalMs={300_000} />
      <nav aria-label="breadcrumb" className="mb-4 text-xs text-slate-500">
        <ol className="flex items-center gap-1.5">
          <li><a href={`/${locale}`} className="hover:text-slate-300">{dict.nav.home}</a></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-slate-300">{dict.nav.today}</li>
        </ol>
      </nav>

      <h1 className="text-2xl font-extrabold tracking-tight text-white">{dict.nav.today}</h1>
      <p className="mt-1 text-sm text-slate-400">{formatDayGroup(today, locale, tz)}</p>
      <div aria-hidden="true" className="hairline-gold mt-4 w-24" />

      <div className="mt-6">
        {result?.stale && <div className="mb-4"><StaleNotice message={dict.common.cachedNotice} /></div>}
        {failed && <ErrorState title={dict.common.errorTitle} body={dict.common.errorBody} />}
        {isEmpty && (
          <MatchList matches={[]} locale={locale} dict={dict} tz={tz} emptyTitle={dict.common.emptyMatches} emptyBody={dict.common.emptyMatchesBody} />
        )}
        {result && result.data.length > 0 && (
          <>
            <Section title={dict.home.liveNow} matches={live} locale={locale} dict={dict} tz={tz} accent="text-red-400" />
            <Section title={dict.nav.upcoming} matches={upcoming} locale={locale} dict={dict} tz={tz} />
            <Section title={dict.nav.results} matches={finished} locale={locale} dict={dict} tz={tz} />
            <Section title={dict.match.statusPostponed} matches={other} locale={locale} dict={dict} tz={tz} />
          </>
        )}
      </div>
    </div>
  );
}

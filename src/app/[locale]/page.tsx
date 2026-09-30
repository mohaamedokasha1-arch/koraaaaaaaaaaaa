import Link from 'next/link';
import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { getLiveMatches, getMatchesByDate, getResults, localToday } from '@/lib/football';
import { ALL_LEAGUES } from '@/lib/constants';
import { LiveMatches } from '@/components/live-matches';
import { MatchList } from '@/components/match-list';
import { TeamLogo } from '@/components/team-logo';
import { ErrorState } from '@/components/empty-state';
import { AutoRefresh } from '@/components/auto-refresh';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return {
    title: `${dict.site.name} - ${dict.site.tagline}`,
    description: dict.site.description,
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const dict = getDictionary(locale);

  const [liveResult, todayResult] = await Promise.allSettled([
    getLiveMatches(),
    getMatchesByDate(localToday()),
  ]);

  const live = liveResult.status === 'fulfilled' ? liveResult.value : null;
  const today = todayResult.status === 'fulfilled' ? todayResult.value : null;

  // if today is a rest day (international break etc.), surface recent results instead
  let recent: { date: string; matches: import('@/lib/types').UnifiedMatch[] }[] | null = null;
  if (today && today.data.length === 0) {
    try {
      const r = await getResults(10);
      recent = r.data.length ? r.data : null;
    } catch {
      recent = null;
    }
  }

  const quickCards = [
    { href: `/${locale}/live`, title: dict.home.quickLive, desc: dict.home.quickLiveD, icon: 'M12 8v4l2.5 2.5M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z' },
    { href: `/${locale}/today`, title: dict.home.quickToday, desc: dict.home.quickTodayD, icon: 'M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z' },
    { href: `/${locale}/standings`, title: dict.home.quickStandings, desc: dict.home.quickStandingsD, icon: 'M4 20h16M6 16v-6M12 16V6M18 16v-3' },
    { href: `/${locale}/top-scorers`, title: dict.home.quickScorers, desc: dict.home.quickScorersD, icon: 'M12 2l2.9 6.3 6.6.8-4.9 4.6 1.3 6.6L12 17l-5.9 3.3 1.3-6.6L2.5 9.1l6.6-.8L12 2Z' },
  ];

  return (
    <div className="container-page py-6 sm:py-8 space-y-10">
      <AutoRefresh intervalMs={300_000} />
      {/* Hero */}
      <section className="card relative overflow-hidden px-6 py-12 sm:px-10 sm:py-16 text-center">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hero-glow" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 pitch-pattern opacity-[0.14]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 field-texture opacity-60" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-navy-950/70 to-transparent" />
        <div className="relative">
          <p className="eyebrow mb-3 justify-center">{dict.site.tagline}</p>
          <h1 className="text-hero mx-auto max-w-3xl text-2xl sm:text-4xl">{dict.home.heroTitle}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm sm:text-base text-slate-400">{dict.home.heroSubtitle}</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href={`/${locale}/live`} className="btn-primary relative">
              <span aria-hidden="true" className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              {dict.nav.live}
            </Link>
            <Link href={`/${locale}/today`} className="btn-ghost">{dict.nav.today}</Link>
          </div>
        </div>
      </section>

      {/* Live */}
      <section aria-label={dict.nav.live}>
        <LiveMatches
          locale={locale}
          dict={dict}
          initial={live ? { matches: live.data, stale: live.stale, fetchedAt: live.fetchedAt } : null}
        />
      </section>

      {/* Today */}
      <section aria-label={dict.nav.today}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">{dict.home.todayMatches}</h2>
          <Link href={`/${locale}/today`} className="link-accent text-sm font-medium">
            {dict.common.viewAll} <span aria-hidden="true" className="inline-block rtl:-scale-x-100">←</span>
          </Link>
        </div>
        {today && today.data.length > 0 ? (
          <MatchList matches={today.data.slice(0, 12)} locale={locale} dict={dict} />
        ) : recent ? (
          <div className="space-y-6">
            <p className="text-sm text-slate-400">{dict.common.emptyMatchesBody}</p>
            {recent.slice(0, 2).map((g) => (
              <div key={g.date}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {new Date(`${g.date}T12:00:00Z`).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <MatchList matches={g.matches.slice(0, 10)} locale={locale} dict={dict} />
              </div>
            ))}
          </div>
        ) : today ? (
          <MatchList matches={[]} locale={locale} dict={dict} />
        ) : (
          <ErrorState title={dict.common.errorTitle} body={dict.common.dataUnavailable} />
        )}
      </section>

      {/* Featured leagues */}
      <section aria-label={dict.home.featuredLeagues}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">{dict.home.featuredLeagues}</h2>
          <Link href={`/${locale}/leagues`} className="link-accent text-sm font-medium">
            {dict.common.viewAll} <span aria-hidden="true" className="inline-block rtl:-scale-x-100">←</span>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {ALL_LEAGUES.map((l) => (
            <Link
              key={l.fdCode}
              href={`/${locale}/leagues/${l.fdCode}`}
              className="card card-hover group flex flex-col items-center gap-3 px-4 py-5 text-center"
            >
              <span className="crest-tile h-14 w-14 transition-colors group-hover:ring-navy-500">
                <TeamLogo src={l.emblem} alt={l.nameEn} size={38} />
              </span>
              <span className="text-sm font-semibold text-white leading-tight">
                {locale === 'ar' ? l.nameAr : l.nameEn}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-slate-500">
                {locale === 'ar' ? l.countryAr : l.country}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Quick nav */}
      <section aria-label={dict.home.quickNav}>
        <h2 className="section-title mb-3">{dict.home.quickNav}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickCards.map((c) => (
            <Link key={c.href} href={c.href} className="card card-hover group flex items-start gap-3 px-5 py-4">
              <span className="mt-0.5 rounded-lg bg-navy-700/80 p-2 text-navy-200 ring-1 ring-inset ring-navy-600/70 transition-colors group-hover:text-white group-hover:ring-navy-400/70">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d={c.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>
                <span className="block text-sm font-bold text-white">{c.title}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{c.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

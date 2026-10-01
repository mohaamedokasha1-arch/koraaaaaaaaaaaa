import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { getLeagueBundle } from '@/lib/football';
import { leagueByCode } from '@/lib/constants';
import { TeamLogo } from '@/components/team-logo';
import { StandingsTable } from '@/components/standings-table';
import { ScorersTable } from '@/components/scorers-table';
import { MatchList } from '@/components/match-list';
import { EmptyState, StaleNotice } from '@/components/empty-state';
import { num } from '@/lib/format';
import { AutoRefresh } from '@/components/auto-refresh';
import { breadcrumbJsonLd, pageMetadata } from '@/lib/seo';
import { getUserTimeZone } from '@/lib/time';
import {
  groupByMatchday,
  getHistoricalSeason,
  hasHistory,
  historySeasons,
  HISTORY_ATTRIBUTION,
} from '@/lib/historical';

export const dynamic = 'force-dynamic';

const TABS = ['standings', 'fixtures', 'results', 'scorers', 'teams', 'history'] as const;

/** How many matchdays of a historical season we render inline (keeps HTML light). */
const HISTORY_MATCHDAYS_SHOWN = 8;
type Tab = (typeof TABS)[number];

function isTab(v: string | undefined): v is Tab {
  return TABS.includes(v as Tab);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; code: string }>;
}): Promise<Metadata> {
  const { locale, code } = await params;
  const dict = getDictionary(locale);
  const featured = leagueByCode(code);
  const name = locale === 'ar' ? featured?.nameAr ?? code : featured?.nameEn ?? code;
  // Tab and filter variants (?tab=, ?season=) intentionally canonicalise to the
  // league page itself, so the same content is never indexed twice.
  return pageMetadata({
    locale,
    path: `/leagues/${code}`,
    title: dict.seo.leagueTitle.replace('{name}', name),
    description: dict.seo.leagueDesc.replace('{name}', name),
  });
}

export default async function LeagueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; code: string }>;
  searchParams: Promise<{ tab?: string; season?: string }>;
}) {
  const { locale, code } = await params;
  const tz = await getUserTimeZone();
  const { tab: tabParam, season: seasonParam } = await searchParams;
  const dict = getDictionary(locale);
  const featured = leagueByCode(code);
  if (!featured) notFound();

  // The history tab only exists for competitions with a verified open dataset,
  // so the tab is never rendered (and never linked) otherwise.
  const seasons = historySeasons(code);
  const historyAvailable = hasHistory(code) && seasons.length > 0;
  const tab: Tab = isTab(tabParam) && (tabParam !== 'history' || historyAvailable) ? tabParam : 'standings';
  const selectedSeason = seasons.includes(seasonParam ?? '') ? seasonParam! : seasons[0] ?? null;

  const bundle = await getLeagueBundle(code);
  const leagueName = locale === 'ar' ? featured.nameAr : featured.nameEn;

  const standings = bundle.standings;
  const scorers = bundle.scorers;
  const matches = bundle.matches;

  const now = Date.now();
  const fixtures =
    matches?.data
      .filter((m) => m.status === 'scheduled' && new Date(m.utcDate).getTime() >= now - 6 * 3600 * 1000)
      .slice(0, 30) ?? [];
  const results =
    matches?.data
      .filter((m) => m.status === 'finished')
      .sort((a, b) => b.utcDate.localeCompare(a.utcDate))
      .slice(0, 30) ?? [];

  const tabLabel: Record<Tab, string> = {
    standings: dict.leagues.standingsTab,
    fixtures: dict.leagues.fixtures,
    results: dict.leagues.resultsTab,
    scorers: dict.leagues.scorersTab,
    teams: dict.leagues.teamsTab,
    history: dict.leagues.historyTab,
  };

  const history =
    tab === 'history' && historyAvailable && selectedSeason
      ? await getHistoricalSeason(code, selectedSeason)
      : null;
  const historyMatchdays = history ? groupByMatchday(history.data).slice(0, HISTORY_MATCHDAYS_SHOWN) : [];

  const stale = standings?.stale || matches?.stale || scorers?.stale || history?.stale;

  return (
    <div className="container-page py-6 sm:py-8">
      {(tab === 'fixtures' || tab === 'results') && <AutoRefresh intervalMs={900_000} />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd(
              [
                { name: dict.nav.home, path: '/' },
                { name: dict.leagues.title, path: '/leagues' },
                { name: leagueName, path: `/leagues/${code}` },
              ],
              locale,
            ),
          ),
        }}
      />
      <nav aria-label="breadcrumb" className="mb-4 text-xs text-slate-500">
        <ol className="flex items-center gap-1.5">
          <li><Link href={`/${locale}`} className="hover:text-slate-300">{dict.nav.home}</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href={`/${locale}/leagues`} className="hover:text-slate-300">{dict.leagues.title}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-slate-300">{leagueName}</li>
        </ol>
      </nav>

      <header className="card relative flex items-center gap-4 overflow-hidden px-5 py-5">
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 hero-glow opacity-70" />
        <span className="crest-tile relative h-16 w-16">
          <TeamLogo src={featured.emblem} alt={leagueName} size={48} />
        </span>
        <div className="relative min-w-0">
          <h1 className="truncate text-xl sm:text-2xl font-extrabold tracking-tight text-white">{leagueName}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <span className="chip">{locale === 'ar' ? featured.countryAr : featured.country}</span>
          </p>
        </div>
      </header>

      {stale && <div className="mt-4"><StaleNotice message={dict.common.cachedNotice} /></div>}

      <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={leagueName}>
        {TABS.filter((t) => t !== 'history' || historyAvailable).map((t) => (
          <Link
            key={t}
            href={`/${locale}/leagues/${code}?tab=${t}`}
            role="tab"
            aria-selected={tab === t}
            className={`tab-btn shrink-0 ${tab === t ? 'tab-btn-active' : ''}`}
          >
            {tabLabel[t]}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'standings' &&
          (standings && standings.data.length > 0 ? (
            <StandingsTable rows={standings.data} locale={locale} dict={dict} />
          ) : (
            <EmptyState title={dict.common.noData} body={dict.common.dataUnavailable} />
          ))}

        {tab === 'fixtures' &&
          (fixtures.length > 0 ? (
            <MatchList matches={fixtures} locale={locale} dict={dict} tz={tz} />
          ) : (
            <EmptyState title={dict.common.emptyMatches} body={dict.common.emptyMatchesBody} />
          ))}

        {tab === 'results' &&
          (results.length > 0 ? (
            <MatchList matches={results} locale={locale} dict={dict} tz={tz} />
          ) : (
            <EmptyState title={dict.common.emptyMatches} body={dict.common.emptyMatchesBody} />
          ))}

        {tab === 'scorers' &&
          (scorers && scorers.data.length > 0 ? (
            <ScorersTable scorers={scorers.data} locale={locale} dict={dict} />
          ) : (
            <EmptyState title={dict.common.noData} body={dict.common.dataUnavailable} />
          ))}

        {tab === 'history' && historyAvailable && selectedSeason && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5" aria-label={dict.leagues.seasonLabel}>
              {seasons.map((season) => (
                <Link
                  key={season}
                  href={`/${locale}/leagues/${code}?tab=history&season=${season}`}
                  className={`tab-btn shrink-0 tabular-nums ${season === selectedSeason ? 'tab-btn-active' : ''}`}
                  aria-current={season === selectedSeason ? 'true' : undefined}
                >
                  {season}
                </Link>
              ))}
            </div>

            {historyMatchdays.length === 0 ? (
              <EmptyState title={dict.common.noData} body={dict.leagues.historyUnavailable} />
            ) : (
              <div className="space-y-3">
                {historyMatchdays.map((group) => (
                  <section key={group.matchday ?? 'other'} className="card overflow-hidden">
                    <h2 className="border-b border-navy-700/60 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                      {dict.leagues.matchdayLabel} {group.matchday != null ? num(group.matchday, locale) : ''}
                    </h2>
                    <ol className="divide-y divide-navy-800/60">
                      {group.matches.map((m) => (
                        <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 py-2 text-sm">
                          <span className="truncate text-end text-slate-200">{m.home.name}</span>
                          <span className="score-pill text-sm">
                            <span>{m.score.home ?? '–'}</span>
                            <span className="text-slate-500">-</span>
                            <span>{m.score.away ?? '–'}</span>
                          </span>
                          <span className="truncate text-start text-slate-200">{m.away.name}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            )}

            <p className="text-xs text-slate-500">
              {dict.leagues.historyNote}{' '}
              <a
                href={HISTORY_ATTRIBUTION.url}
                target="_blank"
                rel="noopener noreferrer external"
                className="link-accent font-semibold"
              >
                {HISTORY_ATTRIBUTION.name}
              </a>{' '}
              ({HISTORY_ATTRIBUTION.licence})
            </p>
          </div>
        )}

        {tab === 'teams' &&
          (standings && standings.data.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {standings.data.map((r) => (
                <Link
                  key={r.team.id}
                  href={`/${locale}/teams/${r.team.id}`}
                  className="card card-hover flex items-center gap-3 px-4 py-3"
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-navy-800/80 text-xs font-bold text-slate-300 tabular-nums ring-1 ring-inset ring-navy-700/60">
                    {num(r.position, locale)}
                  </span>
                  <TeamLogo src={r.team.crest} alt={r.team.name} size={26} />
                  <span className="text-sm font-semibold text-white">{r.team.name}</span>
                  <span className="ms-auto text-xs text-slate-400 tabular-nums">
                    {num(r.points, locale)} {dict.standings.points}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title={dict.common.noData} body={dict.common.dataUnavailable} />
          ))}
      </div>
    </div>
  );
}

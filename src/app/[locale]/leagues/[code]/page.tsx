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

export const dynamic = 'force-dynamic';

const TABS = ['standings', 'fixtures', 'results', 'scorers', 'teams'] as const;
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
  return {
    title: localeTitle(locale, name, dict),
    description: `${name} - ${dict.standings.title}, ${dict.nav.live}, ${dict.leagues.fixtures} | ${dict.site.name}`,
  };
}

function localeTitle(locale: Locale, name: string, dict: ReturnType<typeof getDictionary>) {
  return locale === 'ar' ? `${name} - الترتيب والنتائج والمواعيد` : `${name} - Scores, Standings & Fixtures`;
}

export default async function LeagueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; code: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale, code } = await params;
  const { tab: tabParam } = await searchParams;
  const dict = getDictionary(locale);
  const featured = leagueByCode(code);
  if (!featured) notFound();

  const tab: Tab = isTab(tabParam) ? tabParam : 'standings';
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
  };

  const stale = standings?.stale || matches?.stale || scorers?.stale;

  return (
    <div className="container-page py-6 sm:py-8">
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
        {TABS.map((t) => (
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
            <MatchList matches={fixtures} locale={locale} dict={dict} />
          ) : (
            <EmptyState title={dict.common.emptyMatches} body={dict.common.emptyMatchesBody} />
          ))}

        {tab === 'results' &&
          (results.length > 0 ? (
            <MatchList matches={results} locale={locale} dict={dict} />
          ) : (
            <EmptyState title={dict.common.emptyMatches} body={dict.common.emptyMatchesBody} />
          ))}

        {tab === 'scorers' &&
          (scorers && scorers.data.length > 0 ? (
            <ScorersTable scorers={scorers.data} locale={locale} dict={dict} />
          ) : (
            <EmptyState title={dict.common.noData} body={dict.common.dataUnavailable} />
          ))}

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

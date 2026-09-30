import type { Metadata } from 'next';
import Link from 'next/link';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { pageMetadata } from '@/lib/seo';
import { getLeagueTeams } from '@/lib/football';
import { leagueByCode } from '@/lib/constants';
import { TeamLogo } from '@/components/team-logo';
import { LeagueSelect } from '@/components/league-select';
import { EmptyState, ErrorState } from '@/components/empty-state';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    path: '/teams',
    title: dict.seo.teamsTitle,
    description: dict.seo.teamsDesc,
  });
}

export default async function TeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ league?: string }>;
}) {
  const { locale } = await params;
  const { league } = await searchParams;
  const dict = getDictionary(locale);
  const code = leagueByCode(league) ? league! : 'PL';
  const featured = leagueByCode(code)!;
  const leagueName = locale === 'ar' ? featured.nameAr : featured.nameEn;

  let result = null;
  let failed = false;
  try {
    result = await getLeagueTeams(code);
  } catch {
    failed = true;
  }

  return (
    <div className="container-page py-6 sm:py-8">
      <nav aria-label="breadcrumb" className="mb-4 text-xs text-slate-500">
        <ol className="flex items-center gap-1.5">
          <li><Link href={`/${locale}`} className="hover:text-slate-300">{dict.nav.home}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-slate-300">{dict.teams.title}</li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          {dict.teams.title} <span className="font-bold text-slate-400">— {leagueName}</span>
        </h1>
        <LeagueSelect locale={locale} current={code} basePath="/teams" label={dict.standings.selectLeague} />
      </div>
      <div aria-hidden="true" className="hairline-gold mt-4 w-24" />

      <div className="mt-6">
        {failed && <ErrorState title={dict.common.errorTitle} body={dict.common.errorBody} />}
        {result && result.data.length === 0 && (
          <EmptyState title={dict.common.noData} body={dict.common.dataUnavailable} />
        )}
        {result && result.data.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {result.data.map((t) => (
              <Link
                key={t.id}
                href={`/${locale}/teams/${t.id}`}
                className="card card-hover group flex flex-col items-center gap-3 px-4 py-5 text-center"
              >
                <span className="crest-tile h-14 w-14 transition-colors group-hover:ring-navy-500">
                  <TeamLogo src={t.crest} alt={t.name} size={38} />
                </span>
                <span className="text-sm font-semibold text-white leading-tight">{t.name}</span>
                {t.country && <span className="text-[11px] uppercase tracking-wide text-slate-500">{t.country}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

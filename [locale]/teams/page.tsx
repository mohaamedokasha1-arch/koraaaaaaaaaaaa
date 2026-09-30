import type { Metadata } from 'next';
import Link from 'next/link';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { getLeagueTeams } from '@/lib/football';
import { featuredByFdCode, FEATURED_LEAGUES } from '@/lib/constants';
import { TeamLogo } from '@/components/team-logo';
import { LeagueSelect } from '@/components/league-select';
import { EmptyState, ErrorState } from '@/components/empty-state';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const dict = getDictionary(params.locale);
  return { title: `${dict.teams.title} - ${dict.site.name}`, description: dict.site.description };
}

export default async function TeamsPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams: { league?: string };
}) {
  const { locale } = params;
  const dict = getDictionary(locale);
  const code = FEATURED_LEAGUES.some((l) => l.fdCode === searchParams.league)
    ? searchParams.league!
    : 'PL';
  const featured = featuredByFdCode(code)!;
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
        <h1 className="text-2xl font-extrabold text-white">
          {dict.teams.title} <span className="text-slate-400">— {leagueName}</span>
        </h1>
        <LeagueSelect locale={locale} current={code} basePath="/teams" label={dict.standings.selectLeague} />
      </div>

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
                className="card card-hover flex flex-col items-center gap-2 px-4 py-5 text-center"
              >
                <TeamLogo src={t.crest} alt={t.name} size={44} />
                <span className="text-sm font-semibold text-white leading-tight">{t.name}</span>
                {t.country && <span className="text-xs text-slate-500">{t.country}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

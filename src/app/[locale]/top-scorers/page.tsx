import type { Metadata } from 'next';
import Link from 'next/link';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { pageMetadata } from '@/lib/seo';
import { getScorers } from '@/lib/football';
import { isFdCovered, leagueByCode } from '@/lib/constants';
import { ScorersTable } from '@/components/scorers-table';
import { LeagueSelect } from '@/components/league-select';
import { EmptyState, ErrorState, StaleNotice } from '@/components/empty-state';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    path: '/top-scorers',
    title: dict.seo.scorersTitle,
    description: dict.seo.scorersDesc,
  });
}

export default async function TopScorersPage({
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
    result = await getScorers(code);
  } catch {
    // competitions outside football-data's free plan have no scorer feed in the
    // configured providers — that is a "not available" state, not a breakage
    failed = isFdCovered(code);
  }

  return (
    <div className="container-page py-6 sm:py-8">
      <nav aria-label="breadcrumb" className="mb-4 text-xs text-slate-500">
        <ol className="flex items-center gap-1.5">
          <li><Link href={`/${locale}`} className="hover:text-slate-300">{dict.nav.home}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-slate-300">{dict.scorers.title}</li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          {dict.scorers.title} <span className="font-bold text-slate-400">— {leagueName}</span>
        </h1>
        <LeagueSelect locale={locale} current={code} basePath="/top-scorers" label={dict.standings.selectLeague} />
      </div>
      <div aria-hidden="true" className="hairline-gold mt-4 w-24" />

      <div className="mt-6">
        {result?.stale && <div className="mb-4"><StaleNotice message={dict.common.cachedNotice} /></div>}
        {failed && <ErrorState title={dict.common.errorTitle} body={dict.common.errorBody} />}
        {result === null && !failed && (
          <EmptyState title={dict.common.noData} body={dict.common.dataUnavailable} />
        )}
        {result && result.data.length === 0 && (
          <EmptyState title={dict.common.noData} body={dict.common.dataUnavailable} />
        )}
        {result && result.data.length > 0 && (
          <ScorersTable scorers={result.data} locale={locale} dict={dict} leagueCode={code} />
        )}
      </div>
    </div>
  );
}

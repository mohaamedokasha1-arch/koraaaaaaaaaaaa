import Link from 'next/link';
import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { pageMetadata } from '@/lib/seo';
import { getLeagues } from '@/lib/football';
import { ALL_LEAGUES, isFdCovered } from '@/lib/constants';
import { TeamLogo } from '@/components/team-logo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    path: '/leagues',
    title: dict.seo.leaguesTitle,
    description: dict.seo.leaguesDesc,
  });
}

export default async function LeaguesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const dict = getDictionary(locale);

  // live provider list when available; the curated featured list is the baseline
  let providerLeagues: { code: string; name: string; emblem: string | null; country: string | null }[] = [];
  try {
    const result = await getLeagues();
    providerLeagues = result.data
      .filter((l) => l.code)
      .map((l) => ({ code: l.code!, name: l.name, emblem: l.emblem, country: l.country }));
  } catch {
    providerLeagues = [];
  }

  const byCode = new Map(providerLeagues.map((l) => [l.code, l]));
  // featured competitions come from the provider list when it is available;
  // competitions outside football-data's free plan are always listed
  const featured = ALL_LEAGUES.filter(
    (f) => !isFdCovered(f.fdCode) || byCode.size === 0 || byCode.has(f.fdCode),
  );

  return (
    <div className="container-page py-6 sm:py-8">
      <nav aria-label="breadcrumb" className="mb-4 text-xs text-slate-500">
        <ol className="flex items-center gap-1.5">
          <li><a href={`/${locale}`} className="hover:text-slate-300">{dict.nav.home}</a></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-slate-300">{dict.leagues.title}</li>
        </ol>
      </nav>

      <h1 className="text-2xl font-extrabold tracking-tight text-white">{dict.leagues.title}</h1>
      <div aria-hidden="true" className="hairline-gold mt-4 w-24" />

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((f) => {
          const live = byCode.get(f.fdCode);
          return (
            <Link
              key={f.fdCode}
              href={`/${locale}/leagues/${f.fdCode}`}
              className="card card-hover group flex items-center gap-4 px-5 py-4"
            >
              <span className="crest-tile h-14 w-14 transition-colors group-hover:ring-navy-500">
                <TeamLogo src={live?.emblem ?? f.emblem} alt={f.nameEn} size={40} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-white">
                  {locale === 'ar' ? f.nameAr : (live?.name ?? f.nameEn)}
                </p>
                <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">
                  {locale === 'ar' ? f.countryAr : (live?.country ?? f.country)}
                </p>
              </div>
              <span
                aria-hidden="true"
                className="ms-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-navy-700/70 text-slate-400 transition-colors group-hover:border-navy-400/70 group-hover:text-navy-200"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

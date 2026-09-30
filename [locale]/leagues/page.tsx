import Link from 'next/link';
import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { getLeagues } from '@/lib/football';
import { FEATURED_LEAGUES } from '@/lib/constants';
import { TeamLogo } from '@/components/team-logo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return { title: `${dict.leagues.title} - ${dict.site.name}`, description: dict.site.description };
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
  const featured = FEATURED_LEAGUES.filter((f) => byCode.size === 0 || byCode.has(f.fdCode));

  return (
    <div className="container-page py-6 sm:py-8">
      <nav aria-label="breadcrumb" className="mb-4 text-xs text-slate-500">
        <ol className="flex items-center gap-1.5">
          <li><a href={`/${locale}`} className="hover:text-slate-300">{dict.nav.home}</a></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-slate-300">{dict.leagues.title}</li>
        </ol>
      </nav>

      <h1 className="text-2xl font-extrabold text-white">{dict.leagues.title}</h1>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((f) => {
          const live = byCode.get(f.fdCode);
          return (
            <Link
              key={f.fdCode}
              href={`/${locale}/leagues/${f.fdCode}`}
              className="card card-hover flex items-center gap-4 px-5 py-4"
            >
              <TeamLogo src={live?.emblem ?? f.emblem} alt={f.nameEn} size={44} />
              <div>
                <p className="text-base font-bold text-white">
                  {locale === 'ar' ? f.nameAr : (live?.name ?? f.nameEn)}
                </p>
                <p className="text-xs text-slate-500">{locale === 'ar' ? f.countryAr : (live?.country ?? f.country)}</p>
              </div>
              <svg viewBox="0 0 24 24" className="ms-auto h-4 w-4 text-slate-500 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

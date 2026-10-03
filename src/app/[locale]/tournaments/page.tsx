import Link from 'next/link';
import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { pageMetadata } from '@/lib/seo';
import { TOURNAMENTS } from '@/lib/tournaments';
import { TeamLogo } from '@/components/team-logo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    path: '/tournaments',
    title: dict.seo.tournamentsTitle,
    description: dict.seo.tournamentsDesc,
  });
}

export default async function TournamentsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const dict = getDictionary(locale);

  return (
    <div className="container-page py-6 sm:py-8">
      <nav aria-label="breadcrumb" className="mb-4 text-xs text-slate-500">
        <ol className="flex items-center gap-1.5">
          <li><Link href={`/${locale}`} className="hover:text-slate-300">{dict.nav.home}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-slate-300">{dict.tournaments.title}</li>
        </ol>
      </nav>

      <h1 className="text-2xl font-extrabold tracking-tight text-white">{dict.tournaments.title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">{dict.tournaments.indexDesc}</p>
      <div aria-hidden="true" className="hairline-gold mt-4 w-24" />

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOURNAMENTS.map((t) => (
          <Link
            key={t.slug}
            href={`/${locale}/tournaments/${t.slug}`}
            className="card card-hover group flex items-center gap-4 px-5 py-4"
          >
            <span className="crest-tile h-14 w-14 transition-colors group-hover:ring-navy-500">
              <TeamLogo src={t.logo} alt={locale === 'ar' ? t.nameAr : t.nameEn} size={40} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-white">{locale === 'ar' ? t.nameAr : t.nameEn}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">
                {locale === 'ar' ? t.countryAr : t.countryEn}
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
        ))}
      </div>

      <p className="mt-6 text-xs text-slate-500">{dict.tournaments.dataNote}</p>
    </div>
  );
}

import Link from 'next/link';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { FEATURED_LEAGUES } from '@/lib/constants';
import { Logo } from './logo';

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const sections = [
    { href: `/${locale}/live`, label: dict.nav.live },
    { href: `/${locale}/today`, label: dict.nav.today },
    { href: `/${locale}/results`, label: dict.nav.results },
    { href: `/${locale}/upcoming`, label: dict.nav.upcoming },
    { href: `/${locale}/standings`, label: dict.nav.standings },
    { href: `/${locale}/top-scorers`, label: dict.nav.topScorers },
  ];

  return (
    <footer className="mt-12 border-t border-navy-700/60 bg-navy-900">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="text-lg font-extrabold text-white">{dict.site.name}</span>
          </div>
          <p className="mt-3 text-sm text-slate-400">{dict.footer.about}</p>
        </div>
        <nav aria-label={dict.footer.sections}>
          <p className="mb-3 text-sm font-bold text-white">{dict.footer.sections}</p>
          <ul className="space-y-2">
            {sections.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="link-accent text-sm">
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={dict.footer.leagues} className="lg:col-span-2">
          <p className="mb-3 text-sm font-bold text-white">{dict.footer.leagues}</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FEATURED_LEAGUES.map((l) => (
              <li key={l.fdCode}>
                <Link href={`/${locale}/leagues/${l.fdCode}`} className="link-accent text-sm">
                  {locale === 'ar' ? l.nameAr : l.nameEn}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-navy-700/60 py-4">
        <p className="container-page text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {dict.site.name} — {dict.footer.rights}
        </p>
      </div>
    </footer>
  );
}

import Link from 'next/link';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { ALL_LEAGUES } from '@/lib/constants';
import { Logo } from './logo';
import { TimezoneSelect } from './timezone-select';
import { resolveTimeZone } from '@/lib/pure/time';
import { LIVE_ENABLED } from '@/features/live/lib/config';
import { getLiveCopy } from '@/features/live/lib/copy';

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  // Cookie selection is hydrated by the client picker so the shared shell
  // does not force otherwise-static broadcast pages into per-request SSR.
  const tz = resolveTimeZone(null);
  const liveCopy = getLiveCopy(locale);
  const sections = [
    { href: `/${locale}/live`, label: dict.nav.live },
    ...(LIVE_ENABLED ? [
      { href: `/${locale}/watch`, label: liveCopy.title },
      { href: `/${locale}/watch/copyright`, label: liveCopy.copyright },
      { href: `/${locale}/watch/disclaimer`, label: liveCopy.disclaimer },
    ] : []),
    { href: `/${locale}/today`, label: dict.nav.today },
    { href: `/${locale}/results`, label: dict.nav.results },
    { href: `/${locale}/upcoming`, label: dict.nav.upcoming },
    { href: `/${locale}/standings`, label: dict.nav.standings },
    { href: `/${locale}/top-scorers`, label: dict.nav.topScorers },
  ];

  return (
    <footer className="relative mt-14 border-t border-navy-700/60 bg-navy-900/80">
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-px h-px bg-[linear-gradient(90deg,transparent,rgba(217,169,63,0.5),transparent)]" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 field-texture opacity-70" />
      <div className="container-page relative grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo className="h-9 w-9" />
            <span className="text-lg font-extrabold text-white">{dict.site.name}</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">{dict.footer.about}</p>
          <div aria-hidden="true" className="mt-4 h-px w-16 bg-[linear-gradient(90deg,rgba(217,169,63,0.8),transparent)]" />
        </div>
        <nav aria-label={dict.footer.sections}>
          <p className="mb-3 text-sm font-bold text-white">{dict.footer.sections}</p>
          <ul className="space-y-2">
            {sections.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="link-accent inline-flex items-center gap-2 text-sm">
                  <span aria-hidden="true" className="h-1 w-1 rounded-full bg-navy-400" />
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={dict.footer.leagues} className="lg:col-span-2">
          <p className="mb-3 text-sm font-bold text-white">{dict.footer.leagues}</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ALL_LEAGUES.map((l) => (
              <li key={l.fdCode}>
                <Link href={`/${locale}/leagues/${l.fdCode}`} className="link-accent text-sm">
                  {locale === 'ar' ? l.nameAr : l.nameEn}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="relative border-t border-navy-700/60 py-4">
        <div className="container-page flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-center text-xs text-slate-500 sm:text-start">
            © {new Date().getFullYear()} {dict.site.name} — {dict.footer.rights}
          </p>
          {/* Viewer timezone: stored UTC everywhere, rendered in the reader's zone. */}
          <TimezoneSelect current={tz} locale={locale} />
        </div>
      </div>
    </footer>
  );
}

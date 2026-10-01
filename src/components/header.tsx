import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import Link from 'next/link';
import { Suspense } from 'react';
import { SearchBox } from './search-box';
import { LangSwitcher } from './lang-switcher';
import { NavLinks, MobileNav } from './nav-links';
import { Logo } from './logo';
import { getPersonalCopy } from '@/features/personalization/lib/copy';

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <header className="sticky top-0 z-40 border-b border-navy-700/60 bg-navy-900/85 backdrop-blur-xl">
      {/* floodlight wash behind the brand mark — decorative only */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 start-0 w-80 bg-[radial-gradient(60%_130%_at_12%_50%,rgba(47,83,145,0.38),transparent_72%)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-[linear-gradient(90deg,transparent,rgba(217,169,63,0.65),transparent)]"
      />
      <div className="container-page relative flex h-16 items-center gap-2 sm:gap-3">
        <Link href={`/${locale}`} className="group flex items-center gap-2 shrink-0 sm:gap-2.5" aria-label="KoraScore">
          <Logo className="h-8 w-8 sm:h-9 sm:w-9 drop-shadow-[0_3px_10px_rgba(217,169,63,0.22)] transition-transform duration-200 group-hover:scale-[1.04]" />
          <span className="text-base font-extrabold tracking-tight text-white sm:text-lg">
            {dict.site.name}
          </span>
        </Link>

        <nav className="hidden xl:flex xl:items-center xl:gap-1 ms-5" aria-label="Main">
          <NavLinks locale={locale} dict={dict} variant="desktop" />
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <SearchBox locale={locale} dict={dict} />
          <Link href={`/${locale}/profile`} prefetch={false} className="btn-ghost min-w-[44px] justify-center !px-3 shrink-0" aria-label={getPersonalCopy(locale).profile} title={getPersonalCopy(locale).profile}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" strokeLinecap="round" /></svg>
          </Link>
          <Suspense fallback={null}>
            <LangSwitcher locale={locale} />
          </Suspense>
          <div className="xl:hidden">
            <MobileNav locale={locale} dict={dict} />
          </div>
        </div>
      </div>
    </header>
  );
}

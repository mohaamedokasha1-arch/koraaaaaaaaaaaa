import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import Link from 'next/link';
import { Suspense } from 'react';
import { SearchBox } from './search-box';
import { LangSwitcher } from './lang-switcher';
import { NavLinks, MobileNav } from './nav-links';
import { Logo } from './logo';

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <header className="sticky top-0 z-40 border-b border-navy-700/60 bg-navy-900/95 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-3">
        <Link href={`/${locale}`} className="flex items-center gap-2 shrink-0" aria-label="KoraScore">
          <Logo className="h-8 w-8" />
          <span className="text-lg font-extrabold tracking-tight text-white">
            {dict.site.name}
          </span>
        </Link>

        <nav className="hidden lg:flex lg:items-center lg:gap-1 ms-4" aria-label="Main">
          <NavLinks locale={locale} dict={dict} variant="desktop" />
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <SearchBox locale={locale} dict={dict} />
          <Suspense fallback={null}>
            <LangSwitcher locale={locale} />
          </Suspense>
          <div className="lg:hidden">
            <MobileNav locale={locale} dict={dict} />
          </div>
        </div>
      </div>
    </header>
  );
}

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
      <div className="container-page relative flex h-16 items-center gap-3">
        <Link href={`/${locale}`} className="group flex items-center gap-2.5 shrink-0" aria-label="KoraScore">
          <Logo className="h-9 w-9 drop-shadow-[0_3px_10px_rgba(217,169,63,0.22)] transition-transform duration-200 group-hover:scale-[1.04]" />
          <span className="text-lg font-extrabold tracking-tight text-white">
            {dict.site.name}
          </span>
        </Link>

        <nav className="hidden lg:flex lg:items-center lg:gap-1 ms-5" aria-label="Main">
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

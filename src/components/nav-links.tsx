'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { LIVE_ENABLED } from '@/features/live/lib/config';
import { getLiveCopy } from '@/features/live/lib/copy';

function items(locale: Locale, dict: Dictionary) {
  return [
    { href: `/${locale}`, label: dict.nav.home },
    { href: `/${locale}/live`, label: dict.nav.live },
    ...(LIVE_ENABLED ? [{ href: `/${locale}/watch`, label: getLiveCopy(locale).title }] : []),
    { href: `/${locale}/today`, label: dict.nav.today },
    { href: `/${locale}/results`, label: dict.nav.results },
    { href: `/${locale}/upcoming`, label: dict.nav.upcoming },
    { href: `/${locale}/leagues`, label: dict.nav.leagues },
    { href: `/${locale}/news`, label: dict.nav.news },
  ] as const;
}

export function NavLinks({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
  variant: 'desktop';
}) {
  const pathname = usePathname();
  return (
    <>
      {items(locale, dict).map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== `/${locale}` && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-[40px] inline-flex items-center ${
              active
                ? 'bg-navy-700 text-white shadow-[inset_0_-2px_0_0_rgba(217,169,63,0.9)]'
                : 'text-slate-300 hover:bg-navy-800 hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function MobileNav({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const extra = [
    { href: `/${locale}/standings`, label: dict.nav.standings },
    { href: `/${locale}/top-scorers`, label: dict.nav.topScorers },
    { href: `/${locale}/teams`, label: dict.nav.teams },
    { href: `/${locale}/tournaments`, label: dict.nav.tournaments },
    { href: `/${locale}/news`, label: dict.nav.news },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={dict.nav.home}
        className="btn-ghost !px-3"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          {open ? (
            <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          )}
        </svg>
      </button>
      {open && (
        <nav
          aria-label="Mobile"
          className="absolute end-0 top-full mt-2 w-56 rounded-xl border border-navy-600 bg-navy-850 p-2 shadow-lift ring-1 ring-black/40"
        >
          {[...items(locale, dict), ...extra].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium min-h-[44px] ${
                pathname === item.href
                  ? 'bg-navy-700 text-white'
                  : 'text-slate-200 hover:bg-navy-800'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

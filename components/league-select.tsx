'use client';

import { useRouter } from 'next/navigation';
import { FEATURED_LEAGUES } from '@/lib/constants';
import type { Locale } from '@/i18n/locales';

/** League picker that navigates on change — used on standings & scorers pages. */
export function LeagueSelect({
  locale,
  current,
  basePath,
  label,
}: {
  locale: Locale;
  current: string;
  basePath: string;
  label: string;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-slate-300">
      <span className="sr-only">{label}</span>
      <select
        value={current}
        onChange={(e) => router.push(`/${locale}${basePath}?league=${e.target.value}`)}
        className="rounded-lg border border-navy-600 bg-navy-800 px-3 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-navy-400 min-h-[44px] max-w-[220px] sm:max-w-none"
        aria-label={label}
      >
        {FEATURED_LEAGUES.map((l) => (
          <option key={l.fdCode} value={l.fdCode}>
            {locale === 'ar' ? l.nameAr : l.nameEn}
          </option>
        ))}
      </select>
    </label>
  );
}

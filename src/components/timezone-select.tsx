'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { resolveTimeZone, TIMEZONE_CHOICES, TIMEZONE_COOKIE } from '@/lib/pure/time';
import type { Locale } from '@/i18n/locales';

/**
 * Viewer timezone picker.
 *
 * Times are stored in UTC and rendered in the viewer's zone; the choice lives in
 * a cookie so it never becomes an indexable URL variant (`?tz=` would multiply
 * every page for Google). Changing it refreshes the server components, which is
 * where the formatting happens.
 */
export function TimezoneSelect({ current, locale }: { current: string; locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(current);
  useEffect(() => {
    try {
      const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(`${TIMEZONE_COOKIE}=`));
      setSelected(cookie ? resolveTimeZone(decodeURIComponent(cookie.slice(TIMEZONE_COOKIE.length + 1))) : current);
    } catch { setSelected(current); }
  }, [current]);

  return (
    <label className="flex items-center gap-2 text-xs text-slate-400">
      <span className="sr-only sm:not-sr-only">
        {locale === 'ar' ? 'المنطقة الزمنية' : 'Time zone'}
      </span>
      <select
        value={selected}
        disabled={pending}
        aria-label={locale === 'ar' ? 'اختيار المنطقة الزمنية' : 'Choose time zone'}
        onChange={(event) => {
          const value = event.target.value;
          setSelected(value);
          document.cookie = `${TIMEZONE_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
          window.dispatchEvent(new Event('kora:timezone-change'));
          startTransition(() => router.refresh());
        }}
        className="rounded-md border border-navy-700 bg-navy-900 px-2 py-1 text-xs text-slate-200 focus:border-navy-500 focus:outline-none"
      >
        {TIMEZONE_CHOICES.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {locale === 'ar' ? choice.labelAr : choice.labelEn}
          </option>
        ))}
      </select>
    </label>
  );
}

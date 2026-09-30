'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { otherLocale, type Locale } from '@/i18n/locales';
import Link from 'next/link';

export function LangSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname() ?? `/${locale}`;
  const search = useSearchParams();
  const target = otherLocale(locale);
  // swap the locale segment, keep the rest of the path
  const swapped =
    pathname === `/${locale}`
      ? `/${target}`
      : pathname.replace(new RegExp(`^/${locale}(?=/|$)`), `/${target}`);
  const qs = search?.toString();
  const href = qs ? `${swapped}?${qs}` : swapped;

  return (
    <Link
      href={href}
      hrefLang={target}
      onClick={() => {
        document.cookie = `NEXT_LOCALE=${target};path=/;max-age=31536000;samesite=lax`;
      }}
      className="btn-ghost !px-3 text-xs font-bold"
      aria-label={target === 'ar' ? 'التبديل إلى العربية' : 'Switch to English'}
    >
      {target === 'ar' ? 'ع' : 'EN'}
    </Link>
  );
}

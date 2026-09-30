import Link from 'next/link';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, type Locale } from '@/i18n/locales';

export default function LocaleNotFound({
  params,
}: {
  params?: { locale?: string };
}) {
  const locale: Locale = params?.locale && isLocale(params.locale) ? params.locale : 'ar';
  const dict = getDictionary(locale);
  return (
    <div className="container-page relative flex flex-col items-center gap-4 py-24 text-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-64 hero-glow" />
      <p className="relative text-6xl font-extrabold tracking-tight text-navy-400">404</p>
      <span aria-hidden="true" className="hairline-gold relative w-24" />
      <p className="relative text-lg font-semibold text-white">
        {locale === 'ar' ? 'الصفحة غير موجودة' : 'Page not found'}
      </p>
      <Link href={`/${locale}`} className="btn-primary relative">
        {dict.nav.home}
      </Link>
    </div>
  );
}

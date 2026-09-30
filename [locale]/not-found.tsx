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
    <div className="container-page flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-6xl font-extrabold text-navy-500">404</p>
      <p className="text-lg font-semibold text-white">
        {locale === 'ar' ? 'الصفحة غير موجودة' : 'Page not found'}
      </p>
      <Link href={`/${locale}`} className="btn-primary">
        {dict.nav.home}
      </Link>
    </div>
  );
}

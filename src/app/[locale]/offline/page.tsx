import type { Metadata } from 'next';
import Link from 'next/link';
import { isLocale, type Locale } from '@/i18n/locales';

/**
 * Offline fallback (cached by the service worker at install time).
 *
 * Intentionally self-contained: no provider data, no live numbers, nothing that
 * could be stale — just an honest message and links back into the site. Text is
 * inline in both languages so the page can render instantly from cache.
 */
export const metadata: Metadata = {
  title: 'غير متصل | Offline',
  robots: { index: false, follow: false },
};

export default async function OfflinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'ar';
  const isAr = locale === 'ar';

  return (
    <div className="container-page py-16">
      <div className="card mx-auto max-w-xl px-6 py-10 text-center">
        <p className="eyebrow mb-3 justify-center">{isAr ? 'وضع عدم الاتصال' : 'Offline mode'}</p>
        <h1 className="text-xl font-extrabold text-white sm:text-2xl">
          {isAr ? 'لا يوجد اتصال بالإنترنت' : 'No internet connection'}
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          {isAr
            ? 'لا نعرض بيانات قديمة: بمجرد عودة الاتصال ستُحدَّث النتائج والجداول من جديد.'
            : 'We do not serve stale data: as soon as you are back online, scores and tables refresh from source.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href={`/${locale}`} className="btn-primary">
            {isAr ? 'إعادة المحاولة' : 'Try again'}
          </Link>
          <Link href={`/${locale}/live`} className="btn-ghost">
            {isAr ? 'المباريات المباشرة' : 'Live matches'}
          </Link>
        </div>
      </div>
    </div>
  );
}

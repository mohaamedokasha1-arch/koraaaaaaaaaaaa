import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import '@/app/globals.css';
import { getDictionary } from '@/i18n/dictionaries';
import { isLocale, localeDir, type Locale } from '@/i18n/locales';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// locales render dynamically (see force-dynamic in the pages) — both
// 'ar' and 'en' resolve at request time via dynamicParams (default true).

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = (isLocale(rawLocale) ? rawLocale : 'ar') as Locale;
  const dict = getDictionary(locale);
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${dict.site.name} - ${dict.site.tagline}`,
      template: `%s | ${dict.site.name}`,
    },
    description: dict.site.description,
    alternates: {
      canonical: `/${locale}`,
      languages: { ar: '/ar', en: '/en' },
    },
    openGraph: {
      type: 'website',
      siteName: 'KoraScore',
      title: `${dict.site.name} - ${dict.site.tagline}`,
      description: dict.site.description,
      url: `${SITE_URL}/${locale}`,
      locale: locale === 'ar' ? 'ar_EG' : 'en_GB',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${dict.site.name} - ${dict.site.tagline}`,
      description: dict.site.description,
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#0b1424',
  width: 'device-width',
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const dict = getDictionary(locale);
  const dir = localeDir(locale);

  return (
    <html lang={locale} dir={dir} className="dark" data-scroll-behavior="smooth">
      <body className="flex min-h-screen flex-col bg-navy-950 text-slate-100">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-navy-600 focus:px-4 focus:py-2 focus:text-white"
        >
          {locale === 'ar' ? 'تخطى إلى المحتوى' : 'Skip to content'}
        </a>
        <Header locale={locale} dict={dict} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer locale={locale} dict={dict} />
      </body>
    </html>
  );
}

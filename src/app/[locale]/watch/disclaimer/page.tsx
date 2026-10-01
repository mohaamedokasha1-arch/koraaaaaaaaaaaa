import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, locales } from '@/i18n/locales';
import { pageMetadata } from '@/lib/seo';
import { LIVE_ENABLED } from '@/features/live/lib/config';
import { getLiveCopy } from '@/features/live/lib/copy';
import { LiveLegalLinks } from '@/features/live/components/LiveLegalLinks';

export const revalidate = 60;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params; if (!isLocale(locale)) return {};
  const t = getLiveCopy(locale); return pageMetadata({ locale, path: '/watch/disclaimer', title: t.disclaimer, description: t.disclaimerBody, indexable: LIVE_ENABLED });
}
export default async function DisclaimerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale) || !LIVE_ENABLED) notFound(); const t = getLiveCopy(locale);
  return <div className="container-page max-w-3xl space-y-6 py-8"><h1 className="text-2xl font-bold text-white">{t.disclaimer}</h1><div className="card space-y-4 p-6 text-sm leading-8 text-slate-300"><p>{t.disclaimerBody}</p><p>{t.privacy}</p><p>{t.legalHosting}</p></div><LiveLegalLinks locale={locale} /></div>;
}

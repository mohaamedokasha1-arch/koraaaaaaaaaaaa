import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, locales } from '@/i18n/locales';
import { pageMetadata } from '@/lib/seo';
import { LIVE_ENABLED } from '@/features/live/lib/config';
import { getLiveCopy } from '@/features/live/lib/copy';
import { RightsForm } from '@/features/live/components/RightsForm';
import { LiveLegalLinks } from '@/features/live/components/LiveLegalLinks';

export const revalidate = 60;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params; if (!isLocale(locale)) return {};
  const t = getLiveCopy(locale); return pageMetadata({ locale, path: '/watch/copyright', title: t.copyright, description: t.copyrightIntro, indexable: LIVE_ENABLED });
}
export default async function CopyrightPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale) || !LIVE_ENABLED) notFound(); const t = getLiveCopy(locale);
  const address = process.env.LIVE_RIGHTS_EMAIL ?? '';
  const contact = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) && address.length <= 254 ? address : null;
  return <div className="container-page max-w-3xl space-y-6 py-8"><h1 className="text-2xl font-bold text-white">{t.copyright}</h1><div className="card space-y-4 p-6 text-sm leading-8 text-slate-300"><p>{t.copyrightIntro}</p><p>{t.copyrightBody}</p></div><section className="card space-y-5 p-6"><h2 className="text-lg font-bold text-white">{t.rightsReport}</h2><p className="text-sm leading-7 text-slate-400">{t.rightsBody}</p><RightsForm locale={locale} contact={contact} /></section><LiveLegalLinks locale={locale} /></div>;
}

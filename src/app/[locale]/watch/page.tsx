import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, locales } from '@/i18n/locales';
import { pageMetadata } from '@/lib/seo';
import { LIVE_ENABLED } from '@/features/live/lib/config';
import { getLiveCatalog } from '@/features/live/lib/data';
import { getLiveCopy } from '@/features/live/lib/copy';
import { LiveHub } from '@/features/live/components/LiveHub';
import { OfficialPlatforms } from '@/features/live/components/OfficialPlatforms';
import { LiveLegalLinks } from '@/features/live/components/LiveLegalLinks';
import { LiveIcon } from '@/features/live/components/LiveIcon';

export const revalidate = 60;
export const dynamicParams = true;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getLiveCopy(locale);
  return pageMetadata({ locale, path: '/watch', title: t.title, description: t.description, indexable: LIVE_ENABLED });
}

export default async function BroadcastHubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale) || !LIVE_ENABLED) notFound();
  const { catalog, stale } = await getLiveCatalog();
  const t = getLiveCopy(locale);
  return <div className="container-page space-y-8 py-6 sm:py-8">
    <nav aria-label="breadcrumb" className="text-xs text-slate-400"><Link href={`/${locale}`} className="link-accent underline underline-offset-4">{t.home}</Link><span aria-hidden="true" className="mx-2">/</span><span aria-current="page">{t.title}</span></nav>
    <header className="card relative overflow-hidden px-6 py-9 sm:px-8 sm:py-12"><div aria-hidden="true" className="pointer-events-none absolute inset-0 hero-glow" /><div aria-hidden="true" className="pointer-events-none absolute inset-0 pitch-pattern opacity-[0.09]" />
      <div className="relative max-w-2xl"><p className="eyebrow !tracking-[0.12em] !text-emerald-300">{t.eyebrow}</p><h1 className="text-hero mt-3 text-3xl leading-tight sm:text-4xl">{t.title}</h1><p className="mt-4 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">{t.description}</p><div className="mt-6 flex flex-wrap gap-3"><span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-xs text-emerald-200"><LiveIcon name="shield" className="h-4 w-4" />{t.officialOnly}</span><span className="inline-flex items-center gap-2 px-1 py-1.5 text-xs text-slate-400"><LiveIcon name="tv" className="h-4 w-4" />{t.direct}</span></div></div>
    </header>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]"><LiveHub renderedAt={Date.now()} initial={catalog} initialStale={stale} locale={locale} /><aside className="space-y-4 lg:sticky lg:top-24"><OfficialPlatforms locale={locale} /><div className="rounded-xl border border-navy-700 p-4"><p className="text-xs text-slate-400">{t.lastUpdate}</p><p className="mt-2 text-xs text-slate-300">{catalog.updatedAt ? <time dateTime={catalog.updatedAt}>{new Date(catalog.updatedAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', { timeZone: 'UTC' })} UTC</time> : t.noPublished}</p></div></aside></div>
    <LiveLegalLinks locale={locale} />
  </div>;
}

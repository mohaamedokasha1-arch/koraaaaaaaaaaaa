import Link from 'next/link';
import type { Metadata } from 'next';
import type { Locale } from '@/i18n/locales';
import { pageMetadata } from '@/lib/seo';
import { getUserTimeZone } from '@/lib/time';
import { getFavoriteCatalog } from '@/features/personalization/lib/catalog';
import { getPersonalCopy } from '@/features/personalization/lib/copy';
import { ProfileClient } from '@/features/personalization/components/ProfileClient';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = getPersonalCopy(locale);
  return pageMetadata({ locale, path: '/profile', title: t.profile, description: t.profileDescription, indexable: false });
}

export default async function ProfilePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = getPersonalCopy(locale);
  const tz = await getUserTimeZone();
  return (
    <div className="container-page space-y-6 py-6 sm:py-8">
      <header className="card relative overflow-hidden px-5 py-7 sm:px-8 sm:py-9">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hero-glow" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 pitch-pattern opacity-[0.08]" />
        <div className="relative grid grid-cols-[48px_minmax(0,1fr)] items-start gap-5 sm:flex sm:flex-wrap sm:items-center">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-16 sm:w-16 border border-[#d9a93f]/30 bg-navy-900/70 text-[#fbdf9b] shadow-card"><svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9.6l6.3-.9L12 3Z" strokeLinejoin="round" /></svg></span>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-semibold text-[#fbdf9b]">{t.localBadge}</span>
            <h1 className="mt-2 text-xl font-extrabold tracking-tight text-white sm:text-3xl">{t.profileTitle}</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">{t.profileIntro}</p>
          </div>
          <Link href={`/${locale}`} prefetch={false} className="btn-ghost col-span-2 w-fit text-xs sm:w-auto">{t.publicHome} ↗</Link>
        </div>
        <p className="relative mt-5 border-t border-navy-700/60 pt-4 text-xs leading-7 text-slate-500">{t.localOnly}</p>
      </header>
      <ProfileClient locale={locale} catalog={getFavoriteCatalog()} tz={tz} />
    </div>
  );
}

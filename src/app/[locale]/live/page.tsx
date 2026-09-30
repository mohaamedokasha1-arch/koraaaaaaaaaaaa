import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { getLiveMatches } from '@/lib/football';
import { LiveMatches } from '@/components/live-matches';
import { pageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    path: '/live',
    title: dict.seo.liveTitle,
    description: dict.seo.liveDesc,
  });
}

export default async function LivePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const dict = getDictionary(locale);

  let initial = null;
  try {
    const live = await getLiveMatches();
    initial = { matches: live.data, stale: live.stale, fetchedAt: live.fetchedAt };
  } catch {
    initial = null;
  }

  return (
    <div className="container-page py-6 sm:py-8">
      <nav aria-label="breadcrumb" className="mb-4 text-xs text-slate-500">
        <ol className="flex items-center gap-1.5">
          <li><a href={`/${locale}`} className="hover:text-slate-300">{dict.nav.home}</a></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-slate-300">{dict.nav.live}</li>
        </ol>
      </nav>
      <LiveMatches locale={locale} dict={dict} initial={initial} />
    </div>
  );
}

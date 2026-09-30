import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { getLiveMatches } from '@/lib/football';
import { LiveMatches } from '@/components/live-matches';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const dict = getDictionary(params.locale);
  const title = dict.nav.live;
  return {
    title: `${title} - ${dict.site.name}`,
    description: dict.site.description,
  };
}

export default async function LivePage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
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

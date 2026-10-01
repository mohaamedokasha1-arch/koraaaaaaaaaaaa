import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { pageMetadata } from '@/lib/seo';
import { getUpcoming } from '@/lib/football';
import { MatchList } from '@/components/match-list';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { formatDayGroup } from '@/lib/format';
import { AutoRefresh } from '@/components/auto-refresh';
import { getUserTimeZone } from '@/lib/time';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    path: '/upcoming',
    title: dict.seo.upcomingTitle,
    description: dict.seo.upcomingDesc,
  });
}

export default async function UpcomingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const tz = await getUserTimeZone();
  const dict = getDictionary(locale);

  let result = null;
  let failed = false;
  try {
    result = await getUpcoming(12);
  } catch {
    failed = true;
  }

  return (
    <div className="container-page py-6 sm:py-8">
      <AutoRefresh intervalMs={900_000} />
      <nav aria-label="breadcrumb" className="mb-4 text-xs text-slate-500">
        <ol className="flex items-center gap-1.5">
          <li><a href={`/${locale}`} className="hover:text-slate-300">{dict.nav.home}</a></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-slate-300">{dict.nav.upcoming}</li>
        </ol>
      </nav>

      <h1 className="text-2xl font-extrabold tracking-tight text-white">{dict.nav.upcoming}</h1>
      <div aria-hidden="true" className="hairline-gold mt-4 w-24" />

      <div className="mt-6 space-y-10">
        {failed && <ErrorState title={dict.common.errorTitle} body={dict.common.errorBody} />}
        {result && result.data.length === 0 && (
          <EmptyState title={dict.common.emptyMatches} body={dict.common.emptyMatchesBody} />
        )}
        {result?.data.map((group) => (
          <section key={group.date}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-400">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#d9a93f]" />
              {formatDayGroup(group.date, locale, tz)}
            </h2>
            <MatchList matches={group.matches} locale={locale} dict={dict} tz={tz} />
          </section>
        ))}
      </div>
    </div>
  );
}

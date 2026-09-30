import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { getUpcoming } from '@/lib/football';
import { MatchList } from '@/components/match-list';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { formatDayGroup } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const dict = getDictionary(params.locale);
  return { title: `${dict.nav.upcoming} - ${dict.site.name}`, description: dict.site.description };
}

export default async function UpcomingPage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
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
      <nav aria-label="breadcrumb" className="mb-4 text-xs text-slate-500">
        <ol className="flex items-center gap-1.5">
          <li><a href={`/${locale}`} className="hover:text-slate-300">{dict.nav.home}</a></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-slate-300">{dict.nav.upcoming}</li>
        </ol>
      </nav>

      <h1 className="text-2xl font-extrabold text-white">{dict.nav.upcoming}</h1>

      <div className="mt-6 space-y-10">
        {failed && <ErrorState title={dict.common.errorTitle} body={dict.common.errorBody} />}
        {result && result.data.length === 0 && (
          <EmptyState title={dict.common.emptyMatches} body={dict.common.emptyMatchesBody} />
        )}
        {result?.data.map((group) => (
          <section key={group.date}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">
              {formatDayGroup(group.date, locale)}
            </h2>
            <MatchList matches={group.matches} locale={locale} dict={dict} />
          </section>
        ))}
      </div>
    </div>
  );
}

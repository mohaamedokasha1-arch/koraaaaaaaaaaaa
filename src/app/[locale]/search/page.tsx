import Link from 'next/link';
import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { searchUnified } from '@/lib/search';
import { breadcrumbJsonLd, pageMetadata } from '@/lib/seo';
import { TeamLogo } from '@/components/team-logo';
import { EmptyState } from '@/components/empty-state';
import { formatMatchDate } from '@/lib/format';
import { getUserTimeZone } from '@/lib/time';

export const dynamic = 'force-dynamic';

/**
 * Internal search page.
 *
 * INDEXING POLICY (Phase 4/6): a user query must never become a crawlable URL.
 * The page is `noindex, follow`, it is disallowed in robots.txt, it is absent
 * from every sitemap, and it carries no canonical to itself (search results are
 * not a canonical destination). Internal links point at entity pages instead,
 * which is also what gives those pages their crawl value.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    path: '/search',
    title: dict.search.title,
    description: dict.search.resultsAreNoindex,
    indexable: false,
  });
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  const tz = await getUserTimeZone();
  const dict = getDictionary(locale);
  const query = (q ?? '').trim().slice(0, 60);

  const result = query.length >= 2
    ? await searchUnified(query).catch(() => null)
    : null;
  const data = result?.data ?? null;

  const breadcrumbs = breadcrumbJsonLd(
    [
      { name: dict.nav.home, path: '/' },
      { name: dict.search.title, path: '/search' },
    ],
    locale,
  );

  const totalHits = data
    ? data.entities.length + data.teams.length + data.leagues.length + data.players.length +
      data.matches.length + data.news.length
    : 0;

  return (
    <div className="container-page py-6 sm:py-8 space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />

      <header>
        <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
          {query ? dict.search.resultsFor.replace('{q}', query) : dict.search.title}
        </h1>
        <p className="mt-1 text-xs text-slate-500">{dict.search.resultsAreNoindex}</p>
      </header>

      {!query || query.length < 2 ? (
        <EmptyState title={dict.search.title} body={dict.common.emptySearchBody} />
      ) : totalHits === 0 ? (
        <EmptyState title={dict.search.noResults} body={dict.search.noResultsBody} />
      ) : (
        <div className="space-y-8">
          {/* Ambiguity first: two clubs can genuinely share a name. */}
          {data?.disambiguation && (
            <section className="card px-4 py-3">
              <h2 className="mb-2 text-sm font-bold text-white">{dict.search.disambiguation}</h2>
              <div className="flex flex-wrap gap-2">
                {data.disambiguation.options.map((option) => (
                  <Link
                    key={option.id}
                    href={`/${locale}/teams/${option.slug}`}
                    className="chip hover:border-navy-500"
                  >
                    <TeamLogo src={option.crest} alt={option.name} size={16} />
                    {locale === 'ar' ? option.nameAr ?? option.name : option.name}
                    {option.country ? <span className="text-slate-500"> · {option.country}</span> : null}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data && data.entities.length > 0 && (
            <section>
              <h2 className="section-title mb-3">{dict.search.entities}</h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.entities.map((entity) => (
                  <li key={entity.id}>
                    <Link
                      href={`/${locale}/${entity.kind === 'league' ? 'leagues' : entity.kind === 'country' ? 'leagues' : 'teams'}/${entity.slug}`}
                      className="card card-hover flex items-center gap-3 px-4 py-3"
                    >
                      <TeamLogo src={entity.crest} alt={entity.name} size={28} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">
                          {locale === 'ar' ? entity.nameAr ?? entity.name : entity.name}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {[entity.kind, entity.country].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data && data.leagues.length > 0 && (
            <section>
              <h2 className="section-title mb-3">{dict.search.leagues}</h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.leagues.map((league) => (
                  <li key={league.id}>
                    <Link href={`/${locale}/leagues/${league.code}`} className="card card-hover flex items-center gap-3 px-4 py-3">
                      <TeamLogo src={league.emblem} alt={league.name} size={28} />
                      <span className="text-sm font-semibold text-white">{league.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data && data.players.length > 0 && (
            <section>
              <h2 className="section-title mb-3">{dict.search.players}</h2>
              <ul className="card divide-y divide-navy-800/70">
                {data.players.map((player) => (
                  <li key={player.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-sm text-slate-100">{player.name}</span>
                    <span className="text-xs text-slate-500">
                      {player.team ? dict.search.viewOnTeam.replace('{team}', player.team) : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data && data.matches.length > 0 && (
            <section>
              <h2 className="section-title mb-3">{dict.search.matches}</h2>
              <ul className="card divide-y divide-navy-800/70">
                {data.matches.map((match) => (
                  <li key={match.id}>
                    <Link href={`/${locale}/matches/${match.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-navy-800/50">
                      <span className="min-w-0 truncate text-sm text-slate-100">
                        {match.home} <span className="text-slate-500">×</span> {match.away}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400 tabular-nums">
                        {match.score ?? formatMatchDate(match.utcDate, locale, tz)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data && data.news.length > 0 && (
            <section>
              <h2 className="section-title mb-3">{dict.search.news}</h2>
              <ul className="card divide-y divide-navy-800/70">
                {data.news.slice(0, 10).map((entry) => (
                  <li key={entry.id} className="px-4 py-3">
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-sm font-medium text-slate-100 hover:text-white"
                    >
                      {entry.title}
                    </a>
                    <p className="mt-1 text-xs text-slate-500">
                      {entry.source}
                      {entry.publishedAt ? ` · ${formatMatchDate(entry.publishedAt, locale, tz)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

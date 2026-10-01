import Link from 'next/link';
import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { getNewsBundle, newsEnabled, newsSources, newsSectionCounts } from '@/lib/news';
import type { NewsEntry, NewsHubSection, NewsStory } from '@/lib/types';
import { breadcrumbJsonLd, absoluteUrl, pageMetadata } from '@/lib/seo';
import { NewsAttribution } from '@/components/news-list';
import { EmptyState } from '@/components/empty-state';
import { formatMatchDate } from '@/lib/format';
import { getUserTimeZone } from '@/lib/time';

export const dynamic = 'force-dynamic';

/**
 * News Hub: Latest + regional sections, real story clustering, pagination.
 *
 * A "story" is a real-world event, not a club feed: when several sources cover
 * the same thing, one card is shown with the other sources listed underneath,
 * so the page reflects the news, not the number of feeds configured. Every card
 * links OUT to the publisher; the platform never re-publishes article text.
 */

const PAGE_SIZE = 24;

const SECTION_ORDER: NewsHubSection[] = [
  'latest',
  'egypt',
  'arab',
  'england',
  'spain',
  'italy',
  'germany',
  'france',
  'africa',
  'europe',
  'world',
];

function sectionLabel(dict: ReturnType<typeof getDictionary>, section: NewsHubSection): string {
  const labels = dict.news as Record<string, string>;
  return labels[section] ?? section;
}

function hubHref(locale: Locale, section: NewsHubSection, page: number, lang?: string): string {
  const params = new URLSearchParams();
  if (section !== 'latest') params.set('section', section);
  if (page > 1) params.set('page', String(page));
  if (lang) params.set('lang', lang);
  const qs = params.toString();
  return `/${locale}/news${qs ? `?${qs}` : ''}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(locale);

  let indexable = false;
  if (newsEnabled()) {
    try {
      const result = await getNewsBundle({ limit: 1 });
      indexable = result.data.entries.length > 0;
    } catch {
      indexable = false;
    }
  }

  return pageMetadata({
    locale,
    path: '/news',
    title: dict.news.title,
    description: dict.news.subtitle,
    indexable,
  });
}

export default async function NewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ section?: string; page?: string; lang?: string }>;
}) {
  const { locale } = await params;
  const { section: rawSection, page: rawPage, lang: rawLang } = await searchParams;
  const tz = await getUserTimeZone();
  const dict = getDictionary(locale);

  const section = (SECTION_ORDER as string[]).includes(rawSection ?? '')
    ? (rawSection as NewsHubSection)
    : 'latest';
  const page = Math.max(1, Math.min(50, Number.parseInt(rawPage ?? '1', 10) || 1));
  const lang = rawLang === 'ar' || rawLang === 'en' ? rawLang : undefined;

  const [counts, bundle] = await Promise.all([
    newsSectionCounts().catch(() => ({}) as Record<string, number>),
    getNewsBundle({ section, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, language: lang }).catch(() => null),
  ]);

  const stories = bundle?.data.stories ?? [];
  const entries = bundle?.data.entries ?? [];
  const sources = newsSources();
  const breadcrumbs = breadcrumbJsonLd(
    [
      { name: dict.nav.home, path: '/' },
      { name: dict.nav.news, path: '/news' },
    ],
    locale,
  );

  // ItemList JSON-LD only for the headlines actually rendered on the page.
  const jsonLd =
    entries.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: dict.news.title,
          url: absoluteUrl(`/${locale}/news`),
          hasPart: entries.slice(0, 20).map((entry) => ({
            '@type': 'NewsArticle',
            headline: entry.title,
            url: entry.url,
            datePublished: entry.publishedAt ?? undefined,
            publisher: { '@type': 'Organization', name: entry.source },
          })),
        }
      : null;

  const visibleSections = SECTION_ORDER.filter(
    (candidate) => candidate === 'latest' || (counts[candidate] ?? 0) > 0,
  );
  const hasNext = entries.length === PAGE_SIZE;

  return (
    <div className="container-page space-y-6 py-6 sm:py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}

      <header>
        <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">{dict.news.title}</h1>
        <p className="mt-1.5 max-w-3xl text-sm text-slate-400">{dict.news.subtitle}</p>
      </header>

      {/* Section tabs — empty sections are hidden, not shown as dead ends. */}
      {visibleSections.length > 1 && (
        <nav aria-label={dict.news.title} className="flex flex-wrap gap-2">
          {visibleSections.map((candidate) => {
            const active = candidate === section;
            return (
              <Link
                key={candidate}
                href={hubHref(locale, candidate, 1, lang)}
                aria-current={active ? 'page' : undefined}
                className={`chip transition-colors ${active ? 'border-pitch bg-pitch/10 text-white' : 'hover:border-navy-500'}`}
              >
                {sectionLabel(dict, candidate)}
                {candidate !== 'latest' && counts[candidate] ? (
                  <span className="ms-1 text-[10px] text-slate-500 tabular-nums">{counts[candidate]}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      )}

      {(counts.ar || counts.en) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{dict.news.allSources}:</span>
          <Link href={hubHref(locale, section, 1)} className={`chip ${!lang ? 'border-pitch text-white' : ''}`}>
            {locale === 'ar' ? 'الكل' : 'All'}
          </Link>
          <Link href={hubHref(locale, section, 1, 'ar')} className={`chip ${lang === 'ar' ? 'border-pitch text-white' : ''}`}>
            العربية
          </Link>
          <Link href={hubHref(locale, section, 1, 'en')} className={`chip ${lang === 'en' ? 'border-pitch text-white' : ''}`}>
            English
          </Link>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState title={dict.news.empty} body={dict.news.emptyBody} />
      ) : (
        <>
          <section aria-label={dict.news.title} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stories.length > 0
              ? stories.map((story) => (
                  <StoryCard key={story.id} story={story} locale={locale} dict={dict} tz={tz} />
                ))
              : entries.map((entry) => <EntryCard key={entry.id} entry={entry} locale={locale} dict={dict} tz={tz} />)}
          </section>

          <nav className="flex items-center justify-between gap-3" aria-label="pagination">
            {page > 1 ? (
              <Link href={hubHref(locale, section, page - 1, lang)} className="chip hover:border-navy-500">
                {dict.news.prev}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-slate-500 tabular-nums">{dict.news.page.replace('{n}', String(page))}</span>
            {hasNext ? (
              <Link href={hubHref(locale, section, page + 1, lang)} className="chip hover:border-navy-500">
                {dict.news.next}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </>
      )}

      <footer className="card space-y-3 px-4 py-4">
        <p className="text-xs leading-relaxed text-slate-500">{dict.news.note}</p>
        <NewsAttribution sources={sources} locale={locale} />
        {bundle?.stale && <p className="text-[11px] text-amber-400/80">{dict.news.emptyBody}</p>}
      </footer>
    </div>
  );
}

/** Meta line shared by both card types: source · time. */
function EntryMeta({ entry, locale, tz }: { entry: NewsEntry; locale: Locale; tz: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500">
      <span className="chip !text-[11px]">{entry.source}</span>
      {entry.publishedAt && (
        <time dateTime={entry.publishedAt} className="tabular-nums">
          {formatMatchDate(entry.publishedAt, locale, tz)}
        </time>
      )}
    </div>
  );
}

function StoryCard({
  story,
  locale,
  dict,
  tz,
}: {
  story: NewsStory;
  locale: Locale;
  dict: ReturnType<typeof getDictionary>;
  tz: string;
}) {
  const { entry } = story;
  return (
    <article className="card card-hover flex h-full flex-col gap-2 px-4 py-4">
      <EntryMeta entry={entry} locale={locale} tz={tz} />
      <h2 className="text-base font-bold leading-snug text-white">
        <a href={entry.url} target="_blank" rel="noopener noreferrer external" className="transition-colors hover:text-navy-200">
          {entry.title}
        </a>
      </h2>
      {entry.excerpt && <p className="text-sm leading-relaxed text-slate-400">{entry.excerpt}</p>}

      {story.coverage.length > 1 && (
        <p className="text-[11px] text-slate-500">
          <span className="text-slate-400">{dict.news.coverageBy} </span>
          {story.coverage
            .filter((source) => source.id !== entry.source.toLowerCase() && source.name !== entry.source)
            .slice(0, 4)
            .map((source, index, list) => (
              <span key={`${source.id}-${index}`}>
                {source.name}
                {index < list.length - 1 ? ' · ' : ''}
              </span>
            ))}
        </p>
      )}

      <a
        href={entry.url}
        target="_blank"
        rel="noopener noreferrer external"
        className="link-accent mt-auto text-xs font-semibold"
      >
        {dict.news.readAtSource.replace('{source}', entry.source)}
      </a>
    </article>
  );
}

function EntryCard({
  entry,
  locale,
  dict,
  tz,
}: {
  entry: NewsEntry;
  locale: Locale;
  dict: ReturnType<typeof getDictionary>;
  tz: string;
}) {
  return (
    <article className="card card-hover flex h-full flex-col gap-2 px-4 py-4">
      <EntryMeta entry={entry} locale={locale} tz={tz} />
      <h2 className="text-base font-bold leading-snug text-white">
        <a href={entry.url} target="_blank" rel="noopener noreferrer external" className="transition-colors hover:text-navy-200">
          {entry.title}
        </a>
      </h2>
      {entry.excerpt && <p className="text-sm leading-relaxed text-slate-400">{entry.excerpt}</p>}
      <a
        href={entry.url}
        target="_blank"
        rel="noopener noreferrer external"
        className="link-accent mt-auto text-xs font-semibold"
      >
        {dict.news.readAtSource.replace('{source}', entry.source)}
      </a>
    </article>
  );
}

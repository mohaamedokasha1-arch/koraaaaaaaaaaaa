import Link from 'next/link';
import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { getNews, newsEnabled, newsSources } from '@/lib/news';
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from '@/lib/seo';
import { NewsList, NewsAttribution } from '@/components/news-list';
import { EmptyState } from '@/components/empty-state';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(locale);

  // A page with no headlines has no value for a search user → not indexable.
  let indexable = false;
  if (newsEnabled()) {
    try {
      const result = await getNews(24);
      indexable = result.data.length > 0;
    } catch {
      indexable = false;
    }
  }

  return pageMetadata({
    locale,
    path: '/news',
    title: dict.seo.newsTitle,
    description: dict.seo.newsDesc,
    indexable,
  });
}

export default async function NewsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const dict = getDictionary(locale);

  let items: Awaited<ReturnType<typeof getNews>> | null = null;
  try {
    items = await getNews(30);
  } catch {
    items = null;
  }

  const sources = newsSources();
  const list = items?.data ?? [];
  const breadcrumbs = breadcrumbJsonLd(
    [
      { name: dict.nav.home, path: '/' },
      { name: dict.nav.news, path: '/news' },
    ],
    locale,
  );
  const jsonLd = list.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: dict.seo.newsTitle,
        url: absoluteUrl(`/${locale}/news`),
        inLanguage: locale,
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: list.slice(0, 20).map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: item.title,
            url: item.url,
          })),
        },
      }
    : null;

  return (
    <div className="container-page py-6 sm:py-8">
      <nav aria-label="breadcrumb" className="mb-4 text-xs text-slate-500">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href={`/${locale}`} className="hover:text-slate-300">
              {dict.nav.home}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-slate-300">
            {dict.nav.news}
          </li>
        </ol>
      </nav>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}

      <header className="mb-5">
        <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">{dict.news.title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-400">{dict.news.subtitle}</p>
      </header>

      {list.length === 0 ? (
        <>
          <EmptyState title={dict.news.empty} body={dict.news.emptyBody} />
          <div className="mt-4">{<NewsAttribution sources={sources} locale={locale} />}</div>
        </>
      ) : (
        <div className="space-y-5">
          <NewsList items={list} locale={locale} dict={dict} />
          <div className="card space-y-1 px-4 py-3">
            <NewsAttribution sources={sources} locale={locale} />
            <p className="text-xs text-slate-500">{dict.news.note}</p>
            {items?.stale && <p className="text-xs text-amber-300">{dict.common.cachedNotice}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

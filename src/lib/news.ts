import 'server-only';
import type { DataResult, NewsItem } from '@/lib/types';
import { CACHE_TTL, cache } from '@/lib/cache';
import { allowRequest, recordFailure, recordSuccess } from '@/lib/circuit';
import { fetchFeed, parseFeedConfig, type FeedConfig } from '@/lib/providers/rssNews';

/**
 * News aggregation service (opt-in).
 *
 * The platform publishes NO third-party article text: it keeps the headline,
 * a short excerpt, the publication time, the source name and a link back to
 * the publisher. Feeds are only read when the operator sets NEWS_FEEDS, which
 * is also the point where the operator confirms that the feed's terms allow
 * this kind of display (see docs/SOURCE-EVALUATION.md for per-source notes —
 * e.g. BBC Sport RSS requires a visible "BBC Sport" credit and permission for
 * business use). Without NEWS_FEEDS the feature stays completely inert.
 */

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'feed';
}

export function newsFeeds(): FeedConfig[] {
  return parseFeedConfig(process.env.NEWS_FEEDS);
}

export function newsEnabled(): boolean {
  return newsFeeds().length > 0;
}

export function newsSources(): { name: string; url: string }[] {
  return newsFeeds().map((f) => ({ name: f.name, url: f.homepage ?? f.url }));
}

function mergeById(items: NewsItem[]): NewsItem[] {
  const seenLinks = new Set<string>();
  const seenTitles = new Set<string>();
  const out: NewsItem[] = [];
  for (const item of items) {
    const titleKey = item.title.toLowerCase().replace(/\s+/g, ' ').slice(0, 90);
    if (seenLinks.has(item.url) || seenTitles.has(titleKey)) continue;
    seenLinks.add(item.url);
    seenTitles.add(titleKey);
    out.push(item);
  }
  return out;
}

function sortByDate(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return 0;
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return b.publishedAt.localeCompare(a.publishedAt);
  });
}

/**
 * Headlines from every configured feed. Partial failure is normal and honest:
 * the surviving sources are shown, failures are recorded in the health registry
 * and an all-feed outage degrades to the last cached list (marked stale).
 */
export async function getNews(limit = 24): Promise<DataResult<NewsItem[]>> {
  const feeds = newsFeeds();
  if (feeds.length === 0) {
    return { data: [], source: 'none', stale: false, fetchedAt: new Date().toISOString() };
  }

  const cacheKey = 'news:all';
  const cached = cache.get<NewsItem[]>(cacheKey);
  if (cached && !cached.stale) return { data: cached.value, source: 'cache', stale: false, fetchedAt: cached.fetchedAt };

  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const id = `news:${slug(feed.name)}`;
      if (!allowRequest(id)) return [] as NewsItem[];
      const started = Date.now();
      try {
        const items = await fetchFeed(feed);
        recordSuccess(id, Date.now() - started);
        return items;
      } catch (err) {
        recordFailure(id, err instanceof Error ? err.message.slice(0, 200) : 'feed error');
        throw err;
      }
    }),
  );

  const fulfilled = results.filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === 'fulfilled');
  if (fulfilled.length === 0) {
    const stale = cache.getStale<NewsItem[]>(cacheKey);
    if (stale) return { data: stale.value, source: 'cache', stale: true, fetchedAt: stale.fetchedAt };
    return { data: [], source: 'none', stale: false, fetchedAt: new Date().toISOString() };
  }

  const merged = sortByDate(mergeById(fulfilled.flatMap((r) => r.value))).slice(0, Math.max(1, limit));
  const fetchedAt = cache.set(cacheKey, merged, CACHE_TTL.NEWS);
  const partial = fulfilled.length < results.length;
  return { data: merged, source: partial ? 'mixed' : 'rss', stale: false, fetchedAt };
}

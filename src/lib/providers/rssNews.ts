import 'server-only';
import { PROVIDER_UA } from './http';
import { parseFeed, type FeedConfig, type FeedItem } from '@/lib/pure/rss';

export { parseFeed, parseFeedConfig, sanitizeFeedText, toIso } from '@/lib/pure/rss';
export type { FeedConfig, FeedItem } from '@/lib/pure/rss';

/**
 * Network layer for licensed news feeds.
 *
 * Rules this module enforces (spec §3 / §21):
 *   • Only feeds the operator explicitly configures are fetched (NEWS_FEEDS).
 *     Nothing is scraped, no undocumented endpoints are called.
 *   • We keep headline + short excerpt + publication date + the source link —
 *     never the full article. The UI must credit the source and link out.
 */

/**
 * Download one feed. Fails loudly (throws) so the caller can record provider
 * health instead of silently caching an empty headline list.
 */
export async function fetchFeed(feed: FeedConfig): Promise<FeedItem[]> {
  const controller = new AbortController();
  const timeout = Number(process.env.NEWS_TIMEOUT_MS ?? 8000);
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(feed.url, {
      headers: {
        'User-Agent': PROVIDER_UA,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`feed ${feed.name} responded ${res.status}`);
    const xml = await res.text();
    return parseFeed(xml, feed);
  } finally {
    clearTimeout(timer);
  }
}

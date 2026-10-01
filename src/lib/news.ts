import 'server-only';
import type {
  DataResult,
  NewsEntry,
  NewsHubSection,
  NewsItem,
  NewsSourceHealthView,
  NewsStory,
} from '@/lib/types';
import { CACHE_TTL, cache } from '@/lib/cache';
import { allowRequest, getHealth, recordFailure, recordSuccess } from '@/lib/circuit';
import { fetchFeed, type FeedConfig } from '@/lib/providers/rssNews';
import {
  clusterStories,
  dedupeItems,
  detectLanguage,
  classifyNews,
  footballRelevance,
  hubCategory,
  linkEntities,
  type IntelItem,
} from '@/lib/pure/newsIntel';
import { resolveFeeds, NEWS_SOURCE_DIRECTORY } from '@/lib/newsSources';
import { linkingHints } from '@/lib/entities';

/**
 * News aggregation + intelligence service (opt-in).
 *
 * Pipeline per item: fetch → sanitise (pure/rss) → language → type → link to
 * entities → hub section → de-duplicate → cluster into stories → cache.
 *
 * Licensing posture is unchanged and deliberate: the platform publishes NO
 * third-party article text — only the headline, a short excerpt, the timestamp,
 * the source credit and a link back. Feeds are read only when the operator
 * enables them (`NEWS_PRESETS` for directory-verified sources, `NEWS_FEEDS` for
 * manual ones); without that the feature is completely inert and `/news` stays
 * out of the index.
 */

export function newsFeeds(): FeedConfig[] {
  return resolveFeeds(process.env.NEWS_PRESETS, process.env.NEWS_FEEDS);
}

export function newsEnabled(): boolean {
  return newsFeeds().length > 0;
}

export function newsSources(): { name: string; url: string }[] {
  return newsFeeds().map((f) => ({ name: f.name, url: f.homepage ?? f.url }));
}

/** Which directory entries the operator has actually switched on. */
export function enabledSourceIds(): string[] {
  const urls = new Set(newsFeeds().map((f) => f.url));
  return NEWS_SOURCE_DIRECTORY.filter((entry) => entry.feedUrl && urls.has(entry.feedUrl)).map((e) => e.id);
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'feed';
}

/** Attach intelligence to a raw headline. */
function enrich(item: NewsItem, hints: ReturnType<typeof linkingHints>): NewsEntry {
  const text = `${item.title} ${item.excerpt}`;
  const language = detectLanguage(text);
  const linked = linkEntities(text, hints);
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    source: item.source,
    sourceUrl: item.sourceUrl,
    publishedAt: item.publishedAt,
    excerpt: item.excerpt,
    imageUrl: item.imageUrl ?? null,
    language,
    category: classifyNews(item.title, item.excerpt),
    hub: hubCategory(
      text,
      linked.map((l) => l.country),
      language,
    ),
    entities: linked.map((l) => ({ id: l.id, name: l.label ?? l.names[0] ?? l.id })),
  };
}

function toIntel(entry: NewsEntry): IntelItem {
  return {
    ...entry,
    entities: entry.entities.map((e) => e.name),
    entityIds: entry.entities.map((e) => e.id),
  };
}

function sortByDate<T extends { publishedAt: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return 0;
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return b.publishedAt.localeCompare(a.publishedAt);
  });
}

interface NewsBundle {
  entries: NewsEntry[];
  stories: NewsStory[];
  partial: boolean;
  fetchedAt: string;
  /** Items dropped by the football-only relevance gate (diagnostics). */
  filtered: number;
}

/**
 * Full enriched bundle (uncached slicing happens per request). Partial failure
 * is normal and honest: surviving sources are shown, failures are recorded in
 * the health registry, and a total outage degrades to the last cached list.
 */
async function loadBundle(): Promise<NewsBundle | null> {
  const feeds = newsFeeds();
  if (feeds.length === 0)
    return { entries: [], stories: [], partial: false, fetchedAt: new Date().toISOString(), filtered: 0 };

  const sourceRank: Record<string, number> = {};
  feeds.forEach((feed, index) => {
    sourceRank[feed.name] = feeds.length - index;
  });

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

  const fulfilled = results.filter(
    (r): r is PromiseFulfilledResult<NewsItem[]> => r.status === 'fulfilled',
  );
  if (fulfilled.length === 0) return null;

  const hints = linkingHints();
  const enriched = sortByDate(
    fulfilled.flatMap((r) => r.value).map((item) => enrich(item, hints)),
  );

  // Football-only gate: general-sports feeds may carry other sports; anything
  // that is clearly not football is dropped here and counted for diagnostics.
  let filtered = 0;
  const footballOnly = enriched.filter((item) => {
    const relevance = footballRelevance(item.title, item.excerpt, item.entities.length);
    if (relevance === 'other') {
      filtered += 1;
      return false;
    }
    return true;
  });

  const deduped = dedupeItems(footballOnly.map(toIntel)) as unknown as NewsEntry[];

  const clusters = clusterStories(deduped.map(toIntel), { sourceRank });
  const byUrl = new Map(deduped.map((entry) => [entry.url, entry]));
  const stories: NewsStory[] = clusters.map((cluster) => {
    const representative = byUrl.get(cluster.representative.url) ?? deduped[0];
    const related = cluster.items
      .filter((i) => i.url !== cluster.representative.url)
      .map((i) => byUrl.get(i.url))
      .filter((e): e is NewsEntry => Boolean(e));
    return {
      id: cluster.key,
      entry: representative,
      coverage: cluster.sources.map((name) => ({ id: slug(name), name })),
      related,
      itemCount: cluster.items.length,
      firstSeen: cluster.firstSeen,
      lastSeen: cluster.lastSeen,
    };
  });

  return {
    entries: sortByDate(deduped),
    stories: stories.sort((a, b) => (b.lastSeen ?? '').localeCompare(a.lastSeen ?? '')),
    partial: fulfilled.length < results.length,
    fetchedAt: new Date().toISOString(),
    filtered,
  };
}

async function getBundle(): Promise<DataResult<NewsBundle>> {
  const cacheKey = 'news:bundle:v2';
  const cached = cache.get<NewsBundle>(cacheKey);
  if (cached && !cached.stale) {
    return { data: cached.value, source: 'cache', stale: false, fetchedAt: cached.fetchedAt };
  }
  try {
    const bundle = await loadBundle();
    if (!bundle) throw new Error('every news feed failed');
    const fetchedAt = cache.set(cacheKey, bundle, CACHE_TTL.NEWS);
    return { data: bundle, source: bundle.partial ? 'mixed' : 'rss', stale: false, fetchedAt };
  } catch (err) {
    const stale = cache.getStale<NewsBundle>(cacheKey);
    if (stale) return { data: stale.value, source: 'cache', stale: true, fetchedAt: stale.fetchedAt };
    throw err;
  }
}

export interface NewsQuery {
  limit?: number;
  offset?: number;
  section?: NewsHubSection;
  /** Entity id (team/league) the user is filtering by. */
  entityId?: string;
  language?: 'ar' | 'en';
}

/**
 * Headlines (compatibility entry point). Returns the newest items, optionally
 * sliced, so existing pages keep working unchanged.
 */
export async function getNews(limit = 24): Promise<DataResult<NewsItem[]>> {
  const bundle = await getNewsBundle({ limit });
  return { ...bundle, data: bundle.data.entries };
}

/** Paginated, filterable, story-clustered news feed. */
export async function getNewsBundle(query: NewsQuery = {}): Promise<DataResult<NewsBundle>> {
  const feeds = newsFeeds();
  if (feeds.length === 0) {
    const empty: NewsBundle = {
      entries: [],
      stories: [],
      partial: false,
      fetchedAt: new Date().toISOString(),
      filtered: 0,
    };
    return { data: empty, source: 'none', stale: false, fetchedAt: empty.fetchedAt };
  }
  const result = await getBundle();
  const { limit = 24, offset = 0, section, entityId, language } = query;

  let entries = result.data.entries;
  let stories = result.data.stories;
  if (section && section !== 'latest') {
    entries = entries.filter((entry) => entry.hub === section);
    stories = stories.filter((story) => story.entry.hub === section);
  }
  if (language) {
    entries = entries.filter((entry) => entry.language === language);
    stories = stories.filter((story) => story.entry.language === language);
  }
  if (entityId) {
    entries = entries.filter((entry) => entry.entities.some((e) => e.id === entityId));
    stories = stories.filter((story) => story.entry.entities.some((e) => e.id === entityId));
  }

  return {
    data: {
      ...result.data,
      entries: entries.slice(offset, offset + Math.max(1, limit)),
      stories: stories.slice(0, Math.max(1, limit)),
    },
    source: result.source,
    stale: result.stale,
    fetchedAt: result.fetchedAt,
  };
}

/** Counts per hub section, for the News Hub navigation. */
export async function newsSectionCounts(): Promise<Record<string, number>> {
  const feeds = newsFeeds();
  if (feeds.length === 0) return {};
  try {
    const result = await getBundle();
    const counts: Record<string, number> = { latest: result.data.entries.length };
    for (const entry of result.data.entries) {
      counts[entry.hub] = (counts[entry.hub] ?? 0) + 1;
      // Language counts power the hub's language filter. The two main languages
      // are tracked individually; anything else stays 'other' and is never
      // presented as if it were Arabic or English.
      const key = entry.language === 'ar' || entry.language === 'en' ? entry.language : 'other';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

/** Headlines linked to one entity — used by team/league/match pages. */
export async function newsForEntity(entityId: string, limit = 6): Promise<DataResult<NewsEntry[]>> {
  try {
    const result = await getNewsBundle({ entityId, limit });
    return { ...result, data: result.data.entries };
  } catch {
    return { data: [], source: 'none', stale: false, fetchedAt: new Date().toISOString() };
  }
}

/** Per-source health: directory metadata joined with the circuit registry. */
export function newsSourceHealth(): NewsSourceHealthView[] {
  const health = new Map(getHealth().map((h) => [h.providerId, h]));
  return newsFeeds().map((feed) => {
    const id = `news:${slug(feed.name)}`;
    const record = health.get(id);
    const descriptor = NEWS_SOURCE_DIRECTORY.find((entry) => entry.name === feed.name);
    return {
      id,
      name: feed.name,
      language: descriptor?.language ?? 'multi',
      status: descriptor?.status ?? 'manual',
      state: record?.state ?? 'idle',
      lastSuccessAt: record?.lastSuccessAt ?? null,
      lastFailureAt: record?.lastFailureAt ?? null,
      consecutiveFailures: record?.consecutiveFailures ?? 0,
      avgLatencyMs: record?.avgLatencyMs ?? 0,
      attributionRequired: descriptor?.attributionRequired ?? true,
    };
  });
}

export type { NewsBundle };

import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/seo';
import { locales } from '@/i18n/locales';
import { ALL_LEAGUES } from '@/lib/constants';
import { entitiesByKind } from '@/lib/entities';
import { getNewsBundle, newsEnabled } from '@/lib/news';
import { hasHistory, historySeasons } from '@/lib/historical';
import { getLiveMatches, getMatchesByDate, localToday } from '@/lib/football';
import { cache } from '@/lib/cache';
import type { UnifiedMatch } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Sitemap children, one per content type.
 *
 * Rules applied here (Phase 6 — crawl budget):
 *   • lastmod is REAL: it comes from when the underlying data was actually
 *     refreshed, never from `new Date()` at request time.
 *   • low-value pages are simply absent: no `?tab=`, no `?league=` filters, no
 *     /search pages, no thin team/match pages, no page that 404s.
 *   • every URL carries reciprocal hreflang alternates (ar/en + x-default).
 */

interface UrlEntry {
  path: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

const STATIC_PAGES: UrlEntry[] = [
  { path: '', changefreq: 'hourly', priority: 1 },
  { path: '/live', changefreq: 'hourly', priority: 0.9 },
  { path: '/today', changefreq: 'hourly', priority: 0.9 },
  { path: '/results', changefreq: 'daily', priority: 0.8 },
  { path: '/upcoming', changefreq: 'daily', priority: 0.8 },
  { path: '/leagues', changefreq: 'daily', priority: 0.8 },
  { path: '/standings', changefreq: 'daily', priority: 0.7 },
  { path: '/top-scorers', changefreq: 'daily', priority: 0.7 },
  { path: '/teams', changefreq: 'daily', priority: 0.7 },
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderUrl(entry: UrlEntry): string {
  const clean = entry.path === '/' ? '' : entry.path;
  const alternates = locales
    .map(
      (locale) =>
        `    <xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(`${SITE_URL}/${locale}${clean}`)}"/>`,
    )
    .join('\n');
  const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${SITE_URL}/ar${clean}`)}"/>`;

  return [
    '  <url>',
    `    <loc>${escapeXml(`${SITE_URL}/ar${clean}`)}</loc>`,
    entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
    entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
    entry.priority != null ? `    <priority>${entry.priority}</priority>` : null,
    alternates,
    xDefault,
    '  </url>',
    // The English counterpart is a real, translated URL — list it explicitly.
    '  <url>',
    `    <loc>${escapeXml(`${SITE_URL}/en${clean}`)}</loc>`,
    entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : null,
    entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
    entry.priority != null ? `    <priority>${entry.priority}</priority>` : null,
    alternates,
    xDefault,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

function render(entries: UrlEntry[]): string {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries
    .map(renderUrl)
    .join('\n')}\n</urlset>\n`;
  return xml;
}

/** Real lastmod for a league page: when its data was last refreshed. */
function leagueLastmod(code: string): string | undefined {
  for (const key of [`leagueMatches:${code}`, `standings:${code}`, `scorers:${code}`]) {
    const hit = cache.get<unknown>(key);
    if (hit) return hit.fetchedAt;
  }
  return undefined;
}

/**
 * Matches this instance can really serve — real ids that render a 200 page.
 *
 * Two sources, in order:
 *   1. the in-memory cache (free: already fetched by real traffic today);
 *   2. if it is empty (cold serverless instance, or a crawl that arrives
 *      before any user) the live/yesterday/today/tomorrow buckets are fetched
 *      from the providers directly. A sitemap built only from cache would be
 *      EMPTY on a cold instance, which tells Google there are no matches at
 *      all — worse than spending one upstream request.
 * Failures are swallowed: an empty `matches` sitemap is a valid sitemap, a
 * 500 is not.
 */
async function sitemapMatches(): Promise<UrlEntry[]> {
  const seen = new Map<string, UrlEntry>();

  const collect = (matches: UnifiedMatch[], perBucket = 60) => {
    for (const match of matches.slice(0, perBucket)) {
      if (seen.has(match.id)) continue;
      seen.set(match.id, {
        path: `/matches/${match.id}`,
        lastmod: match.lastUpdated,
        changefreq: match.status === 'finished' ? 'weekly' : 'hourly',
        priority: 0.6,
      });
    }
  };

  for (const key of cache.keysWithPrefix('matches:')) {
    const hit = cache.get<UnifiedMatch[]>(key);
    if (hit) collect(hit.value);
  }

  if (seen.size === 0) {
    const today = localToday();
    const day = (offset: number) => {
      const value = new Date(`${today}T00:00:00Z`);
      value.setUTCDate(value.getUTCDate() + offset);
      return value.toISOString().slice(0, 10);
    };
    const results = await Promise.allSettled([
      getLiveMatches(),
      getMatchesByDate(day(-1)),
      getMatchesByDate(today),
      getMatchesByDate(day(1)),
    ]);
    for (const result of results) if (result.status === 'fulfilled') collect(result.value.data);
  }

  return [...seen.values()].slice(0, 400);
}

async function buildEntries(type: string): Promise<UrlEntry[] | null> {
  switch (type) {
    case 'static':
      return STATIC_PAGES;
    case 'leagues':
      return ALL_LEAGUES.map((league) => ({
        path: `/leagues/${league.fdCode}`,
        lastmod: leagueLastmod(league.fdCode),
        changefreq: 'daily',
        priority: 0.7,
      }));
    case 'teams': {
      // A page is listed only when a DATA provider can fill it. Wikidata-only
      // refs are enrichment, not a source of live team data.
      const DATA_PROVIDERS = new Set(['fd', 'af', 'tsdb', 'espn', 'ofb']);
      const teams = entitiesByKind('team').filter((entity) =>
        entity.refs.some((ref) => DATA_PROVIDERS.has(ref.provider)),
      );
      return teams
        .map((entity) => ({
          path: `/teams/${entity.slug}`,
          lastmod: entity.updatedAt ?? undefined,
          changefreq: 'daily',
          priority: 0.6,
        }))
        .slice(0, 5000);
    }
    case 'matches':
      return await sitemapMatches();
    case 'news': {
      if (!newsEnabled()) return [];
      const entries: UrlEntry[] = [];
      try {
        const bundle = await getNewsBundle({ limit: 1 });
        if (bundle.data.entries.length > 0) {
          // Only /news itself: section filters live on ?section= and are
          // canonical to /news, so publishing them as URLs would list 404s.
          entries.push({ path: '/news', lastmod: bundle.fetchedAt, changefreq: 'hourly', priority: 0.7 });
        }
      } catch {
        return [];
      }
      return entries;
    }
    case 'archive': {
      // Season archives exist only where a real dataset is behind them.
      const entries: UrlEntry[] = [];
      for (const league of ALL_LEAGUES) {
        if (!hasHistory(league.fdCode)) continue;
        const seasons = historySeasons(league.fdCode);
        if (seasons.length === 0) continue;
        entries.push({ path: `/leagues/${league.fdCode}/archive`, changefreq: 'monthly', priority: 0.5 });
        for (const season of seasons.slice(0, 12)) {
          entries.push({
            path: `/leagues/${league.fdCode}/archive/${season}`,
            changefreq: 'yearly',
            priority: 0.4,
          });
        }
      }
      return entries;
    }
    default:
      return null;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type: rawType } = await params;
  const type = rawType.replace(/\.xml$/, '');
  const entries = await buildEntries(type);
  if (!entries) return NextResponse.json({ error: 'unknown sitemap' }, { status: 404 });

  return new Response(render(entries), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900, s-maxage=900',
    },
  });
}

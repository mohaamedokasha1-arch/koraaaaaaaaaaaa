import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/**
 * Sitemap INDEX (replaces the single monolithic sitemap).
 *
 * Why an index: crawl budget is a finite resource. Splitting by type lets each
 * child carry an honest `lastmod` for the content it lists (matches change by
 * the minute, a club page by the day, a season archive almost never), so Search
 * engines re-crawl what actually changed instead of re-reading everything.
 *
 * The public URL stays exactly `/sitemap.xml`; children live under
 * `/sitemaps/<type>.xml` and each of them lists ONLY pages that return 200 with
 * real data behind them.
 */
const CHILDREN = ['static', 'leagues', 'teams', 'matches', 'news', 'archive'] as const;

export function GET() {
  // No <lastmod> here on purpose: the index itself never changes, and claiming
  // "modified now" on every request is a lie that erodes trust in the signal.
  const body = CHILDREN.map(
    (type) => `  <sitemap>\n    <loc>${SITE_URL}/sitemaps/${type}.xml</loc>\n  </sitemap>`,
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800, s-maxage=1800',
    },
  });
}

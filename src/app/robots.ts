import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * robots.txt
 *
 * Rules (deliberately minimal — blocking a resource Google needs to render a
 * page is worse than letting it crawl one extra URL):
 *   • Everything public is crawlable, including /_next/static (the JS/CSS that
 *     render the pages). The previous `Disallow: /_next/` prevented Googlebot
 *     from fetching the very assets it needs to understand the site.
 *   • Only the JSON API (no value for search users) and Next's image optimizer
 *     endpoints are excluded. They are technical, not hidden content.
 *   • Preview deployments are covered by an X-Robots-Tag header from
 *     next.config.mjs rather than by robots.txt, because a blocked URL can
 *     never be read — so its noindex would never be seen either.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/_next/image',
          '/_next/webpack-hmr',
          // Search result pages are never indexable: a user query must not
          // become a crawlable URL (infinite crawl space + duplicate content).
          '/search',
          '/*?q=',
          '/*?tab=',
          '/*?league=',
          '/*?season=',
          '/*?page=',
        ],
      },
      // Explicitly welcomed — the site wants to be crawled by the major engines.
      { userAgent: 'Googlebot', allow: '/' },
      { userAgent: 'Bingbot', allow: '/' },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

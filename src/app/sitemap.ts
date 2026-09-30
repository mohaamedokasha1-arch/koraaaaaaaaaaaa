import type { MetadataRoute } from 'next';
import { ALL_LEAGUES } from '@/lib/constants';
import { locales } from '@/i18n/locales';
import { SITE_URL, languageAlternates } from '@/lib/seo';
import { newsEnabled } from '@/lib/news';

/**
 * Sitemap
 *
 * Contains only URLs that (a) return 200, (b) are self-canonical and indexable,
 * and (c) have real data behind them.
 *
 * Removed compared to the previous version: `lastModified: new Date()` on every
 * entry. Claiming "everything changed just now" on each request is a false
 * signal and Google learns to ignore it; entries now simply omit lastmod, which
 * is honest for pages whose content is rendered from live provider data.
 */

const STATIC_PAGES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
  { path: '', changeFrequency: 'hourly', priority: 1 },
  { path: '/live', changeFrequency: 'hourly', priority: 0.9 },
  { path: '/today', changeFrequency: 'hourly', priority: 0.9 },
  { path: '/results', changeFrequency: 'daily', priority: 0.8 },
  { path: '/upcoming', changeFrequency: 'daily', priority: 0.8 },
  { path: '/leagues', changeFrequency: 'daily', priority: 0.8 },
  { path: '/standings', changeFrequency: 'daily', priority: 0.7 },
  { path: '/top-scorers', changeFrequency: 'daily', priority: 0.7 },
  { path: '/teams', changeFrequency: 'daily', priority: 0.7 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const paths = [
    ...STATIC_PAGES.map((p) => ({ path: p.path, changeFrequency: p.changeFrequency, priority: p.priority })),
    ...(newsEnabled() ? [{ path: '/news', changeFrequency: 'hourly' as const, priority: 0.7 }] : []),
    // League pages only exist for competitions the app can actually serve.
    ...ALL_LEAGUES.map((l) => ({ path: `/leagues/${l.fdCode}`, changeFrequency: 'daily' as const, priority: 0.7 })),
  ];

  for (const locale of locales) {
    for (const p of paths) {
      entries.push({
        url: `${SITE_URL}/${locale}${p.path}`,
        changeFrequency: p.changeFrequency,
        priority: p.priority,
        alternates: { languages: languageAlternates(p.path) },
      });
    }
  }
  return entries;
}

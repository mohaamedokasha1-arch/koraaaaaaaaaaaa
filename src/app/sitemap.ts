import type { MetadataRoute } from 'next';
import { ALL_LEAGUES } from '@/lib/constants';
import { locales } from '@/i18n/locales';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = ['', '/live', '/today', '/results', '/upcoming', '/leagues', '/standings', '/top-scorers', '/teams'];
  const leaguePaths = ALL_LEAGUES.map((l) => `/leagues/${l.fdCode}`);

  const entries: MetadataRoute.Sitemap = [];
  for (const locale of locales) {
    for (const p of [...staticPaths, ...leaguePaths]) {
      entries.push({
        url: `${SITE_URL}/${locale}${p}`,
        lastModified: new Date(),
        changeFrequency: p === '' || p === '/live' || p === '/today' ? 'hourly' : 'daily',
        priority: p === '' ? 1 : p === '/live' ? 0.9 : 0.7,
        alternates: {
          languages: {
            ar: `${SITE_URL}/ar${p}`,
            en: `${SITE_URL}/en${p}`,
          },
        },
      } as MetadataRoute.Sitemap[number]);
    }
  }
  return entries;
}

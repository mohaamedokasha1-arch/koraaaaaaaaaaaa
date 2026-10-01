import type { MetadataRoute } from 'next';

/**
 * Web App Manifest (PWA).
 *
 * Installable, app-like navigation, and the Arabic-first identity of the site.
 * Deliberately no service-worker-driven data caching is declared here — the SW
 * (public/sw.js) only ever caches static assets and one offline fallback page;
 * it never stores live scores, tables or headlines.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KoraScore — كورة سكور',
    short_name: 'KoraScore',
    description:
      'نتائج مباشرة وترتيب وأخبار كرة القدم من مصادر حقيقية. Live football scores, standings and news from real sources.',
    start_url: '/ar',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b1424',
    theme_color: '#0b1424',
    lang: 'ar',
    dir: 'rtl',
    categories: ['sports', 'news'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'مباشر', short_name: 'Live', url: '/ar/live' },
      { name: 'مباريات اليوم', short_name: 'Today', url: '/ar/today' },
      { name: 'الأخبار', short_name: 'News', url: '/ar/news' },
    ],
  };
}

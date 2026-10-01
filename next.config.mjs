import { liveFrameSources, livePolicy } from './src/features/live/lib/policy.mjs';

// Preserve noindex on Vercel previews. Arena/development must be embeddable in
// the preview viewer; clickjacking protection remains on actual production.
const isProduction = !process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'production';
const deployedProduction = process.env.VERCEL_ENV === 'production';
let liveStoreOrigin = '';
try {
  const store = new URL(process.env.NEXT_PUBLIC_LIVE_SUPABASE_URL ?? '');
  if (store.protocol === 'https:') liveStoreOrigin = store.origin;
} catch { /* optional database */ }
const mediaOrigins = [...new Set([...livePolicy.hlsHosts, ...livePolicy.mediaHosts])].map((host) => `https://${host}`);
const liveCsp = [
  "base-uri 'self'", "object-src 'none'",
  `frame-src ${liveFrameSources().join(' ')}`,
  `media-src 'self' blob: ${mediaOrigins.join(' ')}`,
  `connect-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.twitch.tv ${liveStoreOrigin} ${mediaOrigins.join(' ')}`,
  ...(deployedProduction ? ["frame-ancestors 'self'"] : []),
].join('; ');

// Canonical-host guard. A wrong NEXT_PUBLIC_SITE_URL silently publishes every
// canonical, hreflang and sitemap URL for the wrong host: the pages look
// perfect in a browser and are unusable in Google. Say it at build time,
// where it can still be fixed before the deploy goes live.
{
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  let parsed = null;
  try { parsed = new URL(raw); } catch { /* empty or malformed */ }
  const wrong =
    !parsed ||
    parsed.protocol !== 'https:' ||
    /localhost|127\.0\.0\.1|\.vercel\.app$/i.test(parsed.hostname);
  if (wrong && process.env.VERCEL_ENV === 'production') {
    console.warn(
      `\n[seo] NEXT_PUBLIC_SITE_URL="${raw}" is not a production https domain — ` +
        'canonical URLs, hreflang and sitemap.xml will point there. Set it in ' +
        'Vercel → Settings → Environment Variables (Production) and redeploy.\n',
    );
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // One URL per page: no trailing-slash duplicate of every indexable route.
  trailingSlash: false,
  poweredByHeader: false,
  allowedDevOrigins: ['*.e2b.app', 'localhost', '127.0.0.1'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'crests.football-data.org' },
      { protocol: 'https', hostname: 'www.thesportsdb.com' },
      { protocol: 'https', hostname: 'r2.thesportsdb.com' },
      { protocol: 'https', hostname: 'a.espncdn.com' },
      { protocol: 'https', hostname: 'media.api-sports.io' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          ...(deployedProduction ? [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] : []),
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(isProduction ? [] : [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]),
        ],
      },
      {
        // JSON endpoints are never search results. The header (rather than a
        // robots.txt rule) also covers the Next.js error pages an API route can
        // render, which would otherwise be crawlable HTML on an /api/ URL.
        source: '/api/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      { source: '/:locale/watch/:path*', headers: [{ key: 'Content-Security-Policy', value: liveCsp }] },
      { source: '/live/:path*.json', headers: [{ key: 'Cache-Control', value: 'public, max-age=30, s-maxage=60, stale-while-revalidate=60' }] },
    ];
  },
};
export default nextConfig;

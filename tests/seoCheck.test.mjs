import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHead,
  parseRobotsTxt,
  parseSitemap,
  checkPage,
  checkRobotsTxt,
  checkSitemapIndex,
} from '../src/lib/pure/seoCheck.ts';

/**
 * The audit script is only as good as its parsing: a crawler reads raw HTML,
 * so these cases are raw HTML — including the exact shapes Next.js emits
 * (relative `og:image` resolved by metadataBase, `<link rel="alternate"
 * hreflang>`, JSON-LD inline script).
 */

const ORIGIN = 'https://korascore.example';

const page = (over = {}) => `<!doctype html><html lang="ar" dir="rtl"><head>
<title>الأهلي ضد الزمالك | KoraScore</title>
<meta name="description" content="نتيجة وموعد مباراة الأهلي ضد الزمالك في الدوري المصري الممتاز، الأحداث والتشكيل والترتيب لحظة بلحظة." />
<link rel="canonical" href="${ORIGIN}/ar/matches/123" />
<link rel="alternate" hreflang="ar" href="${ORIGIN}/ar/matches/123" />
<link rel="alternate" hreflang="en" href="${ORIGIN}/en/matches/123" />
<link rel="alternate" hreflang="x-default" href="${ORIGIN}/ar/matches/123" />
<meta property="og:title" content="الأهلي ضد الزمالك" />
<meta property="og:description" content="تغطية مباشرة" />
<meta property="og:image" content="${ORIGIN}/og-default.png" />
<meta property="og:type" content="article" />
<meta name="twitter:card" content="summary_large_image" />
<script type="application/ld+json">{"@context":"https://schema.org","@type":"SportsEvent","name":"الأهلي ضد الزمالك"}</script>
${over.head ?? ''}
</head><body><h1>الأهلي ضد الزمالك</h1></body></html>`;

test('parseHead reads the crawler-visible head', () => {
  const head = parseHead(page());
  assert.equal(head.title, 'الأهلي ضد الزمالك | KoraScore');
  assert.equal(head.canonical, `${ORIGIN}/ar/matches/123`);
  assert.equal(head.og.image, `${ORIGIN}/og-default.png`);
  assert.equal(head.hreflang.en, `${ORIGIN}/en/matches/123`);
  assert.equal(head.hreflang['x-default'], `${ORIGIN}/ar/matches/123`);
  assert.deepEqual(head.jsonLdTypes, ['SportsEvent']);
  assert.equal(head.h1, 'الأهلي ضد الزمالك');
  assert.equal(head.robots, null);
});

test('parseHead understands noindex and @graph JSON-LD', () => {
  const head = parseHead(page({
    head: '<meta name="robots" content="noindex, follow" />'
      + '<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite"},{"@type":"Organization"}]}</script>',
  }));
  assert.equal(head.robots, 'noindex, follow');
  assert.deepEqual(head.jsonLdTypes, ['SportsEvent', 'WebSite', 'Organization']);
});

test('checkPage passes a correctly self-canonicalised page', () => {
  const checks = checkPage({
    url: `${ORIGIN}/ar/matches/123`,
    finalUrl: `${ORIGIN}/ar/matches/123`,
    status: 200,
    headers: {},
    html: page(),
  });
  const failed = checks.filter((c) => c.status === 'fail');
  assert.deepEqual(failed, [], `unexpected failures: ${JSON.stringify(failed)}`);
  assert.equal(checks.find((c) => c.id === 'canonical').status, 'pass');
});

test('checkPage fails a page whose canonical points at the locale home', () => {
  const html = page({ head: '' }).replace(
    `<link rel="canonical" href="${ORIGIN}/ar/matches/123" />`,
    `<link rel="canonical" href="${ORIGIN}/ar" />`,
  );
  const canonical = checkPage({
    url: `${ORIGIN}/ar/matches/123`,
    finalUrl: `${ORIGIN}/ar/matches/123`,
    status: 200,
    headers: {},
    html,
  }).find((c) => c.id === 'canonical');
  assert.equal(canonical.status, 'fail');
  assert.match(canonical.detail, /not self-referencing/);
});

test('checkPage fails a relative canonical (missing SITE_URL/metadataBase)', () => {
  const html = page({ head: '' }).replace(
    `<link rel="canonical" href="${ORIGIN}/ar/matches/123" />`,
    '<link rel="canonical" href="/ar/matches/123" />',
  );
  const canonical = checkPage({
    url: `${ORIGIN}/ar/matches/123`,
    finalUrl: `${ORIGIN}/ar/matches/123`,
    status: 200,
    headers: {},
    html,
  }).find((c) => c.id === 'canonical');
  assert.equal(canonical.status, 'fail');
  assert.match(canonical.detail, /relative/);
});

test('checkPage treats a noindex header as a hard failure on a live page', () => {
  const noindex = checkPage({
    url: `${ORIGIN}/ar/live`,
    finalUrl: `${ORIGIN}/ar/live`,
    status: 200,
    headers: { 'x-robots-tag': 'noindex, nofollow' },
    html: page(),
  }).find((c) => c.id === 'noindex');
  assert.equal(noindex.status, 'fail');
});

test('checkPage expects noindex + 404 on a missing page', () => {
  const checks = checkPage({
    url: `${ORIGIN}/ar/nope`,
    finalUrl: `${ORIGIN}/ar/nope`,
    status: 404,
    headers: {},
    html: page({ head: '<meta name="robots" content="noindex" />' }),
    expectedStatus: 404,
    expectNoindex: true,
  });
  assert.equal(checks.find((c) => c.id === 'status').status, 'pass');
  assert.equal(checks.find((c) => c.id === 'noindex').status, 'pass');
  // A 404 legitimately has no canonical/hreflang/share card; only status and
  // noindex are asserted, so a missing og:image is not reported as a failure.
  assert.deepEqual(checks.map((c) => c.id), ['status', 'noindex']);
});

test('checkPage flags a missing og:image', () => {
  const html = page({ head: '' }).replace(/<meta property="og:image"[^>]*>/, '');
  const image = checkPage({
    url: `${ORIGIN}/ar/matches/123`,
    finalUrl: `${ORIGIN}/ar/matches/123`,
    status: 200,
    headers: {},
    html,
  }).find((c) => c.id === 'og:image');
  assert.equal(image.status, 'fail');
});

test('parseRobotsTxt separates asset rules from real content rules', () => {
  const facts = parseRobotsTxt([
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /_next/image',
    'Disallow: /_next/webpack-hmr',
    '',
    'User-agent: Googlebot',
    'Allow: /',
    '',
    `Sitemap: ${ORIGIN}/sitemap.xml`,
  ].join('\n'));
  assert.equal(facts.blocksAll, false);
  assert.equal(facts.blocksAssets, false, 'image optimizer exclusion must not count as blocking assets');
  assert.deepEqual(facts.sitemaps, [`${ORIGIN}/sitemap.xml`]);
});

test('parseRobotsTxt detects the two rules that break indexing', () => {
  assert.equal(parseRobotsTxt('User-agent: *\nDisallow: /').blocksAll, true);
  assert.equal(parseRobotsTxt('User-agent: *\nDisallow: /_next/').blocksAssets, true);
  assert.equal(parseRobotsTxt('User-agent: *\nDisallow: /_next/static').blocksAssets, true);
});

test('checkRobotsTxt requires /_next/static to stay open and the sitemap to be declared', () => {
  const good = checkRobotsTxt(`User-agent: *\nDisallow: /api/\nSitemap: ${ORIGIN}/sitemap.xml`, ORIGIN);
  assert.ok(good.every((c) => c.status === 'pass'), JSON.stringify(good));

  const bad = checkRobotsTxt(`User-agent: *\nDisallow: /_next/\nSitemap: ${ORIGIN}/sitemap.xml`, ORIGIN);
  assert.equal(bad.find((c) => c.id === 'robots.assets').status, 'fail');

  const noSitemap = checkRobotsTxt('User-agent: *\nAllow: /', ORIGIN);
  assert.equal(noSitemap.find((c) => c.id === 'robots.sitemap').status, 'fail');
});

test('parseSitemap tells an index from a urlset', () => {
  const index = parseSitemap(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${ORIGIN}/sitemaps/static.xml</loc></sitemap>
  <sitemap><loc>${ORIGIN}/sitemaps/matches.xml</loc></sitemap>
</sitemapindex>`);
  assert.equal(index.kind, 'sitemapindex');
  assert.equal(index.locs.length, 2);
  assert.equal(index.malformed, false);

  const urlset = parseSitemap(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${ORIGIN}/ar/live</loc></url></urlset>`);
  assert.equal(urlset.kind, 'urlset');
  assert.deepEqual(urlset.locs, [`${ORIGIN}/ar/live`]);

  assert.equal(parseSitemap('<html>oops</html>').malformed, true);
});

test('checkSitemapIndex rejects URLs on a foreign host', () => {
  const checks = checkSitemapIndex(
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <sitemap><loc>https://korascore.vercel.app/sitemaps/static.xml</loc></sitemap>
    </sitemapindex>`,
    ORIGIN,
  );
  assert.equal(checks.find((c) => c.id === 'sitemap.origin').status, 'fail');
});

test('URLs with a trailing slash or query still count as self-canonical', () => {
  const canonical = checkPage({
    url: `${ORIGIN}/ar/live`,
    finalUrl: `${ORIGIN}/ar/live/`,
    status: 200,
    headers: {},
    html: page({ head: '' }).replace(
      `<link rel="canonical" href="${ORIGIN}/ar/matches/123" />`,
      `<link rel="canonical" href="${ORIGIN}/ar/live?tab=all" />`,
    ),
  }).find((c) => c.id === 'canonical');
  assert.equal(canonical.status, 'pass');
});

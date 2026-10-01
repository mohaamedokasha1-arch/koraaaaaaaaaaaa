/**
 * Pure SEO inspection helpers (no I/O, no imports, no Node/Next APIs).
 *
 * Why they live here: `scripts/seo-check.mjs` needs the same parsing the
 * tests assert against, and a crawler's view of a page is fully determined by
 * status + headers + raw HTML. Keeping the logic pure means the checks are
 * testable without a server, and the script stays a thin fetch/report layer.
 */

export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface HeadFacts {
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  googlebot: string | null;
  hreflang: Record<string, string>;
  og: {
    title: string | null;
    description: string | null;
    image: string | null;
    url: string | null;
    type: string | null;
    locale: string | null;
    siteName: string | null;
  };
  twitter: { card: string | null; image: string | null };
  jsonLdTypes: string[];
  h1: string | null;
  verification: string | null;
}

const META_TAG = /<meta\b[^>]*>/gi;
const ATTR = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of tag.matchAll(ATTR)) {
    out[match[1].toLowerCase()] = (match[3] ?? match[4] ?? match[5] ?? '').trim();
  }
  return out;
}

function decode(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Content of <meta name|property|http-equiv="key">, first occurrence wins. */
function meta(html: string, key: string): string | null {
  const target = key.toLowerCase();
  for (const tag of html.match(META_TAG) ?? []) {
    const a = attrs(tag);
    const id = (a.name ?? a.property ?? a['http-equiv'] ?? '').toLowerCase();
    if (id === target) return decode(a.content ?? '');
  }
  return null;
}

function firstMatch(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match ? decode(match[1]).trim() : null;
}

export function parseHead(html: string): HeadFacts {
  const hreflang: Record<string, string> = {};
  let canonical: string | null = null;
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of linkTags) {
    const a = attrs(tag);
    const rel = (a.rel ?? '').toLowerCase();
    const href = a.href;
    if (!href) continue;
    if (rel === 'canonical') canonical = decode(href);
    else if (rel === 'alternate' && a.hreflang) hreflang[a.hreflang.toLowerCase()] = decode(href);
  }

  const jsonLdTypes: string[] = [];
  for (const block of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed: unknown = JSON.parse(block[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        const record = node as { '@type'?: string | string[]; '@graph'?: { '@type'?: string }[] };
        if (typeof record['@type'] === 'string') jsonLdTypes.push(record['@type']);
        else if (Array.isArray(record['@type'])) jsonLdTypes.push(...record['@type']);
        for (const item of record['@graph'] ?? []) {
          if (typeof item['@type'] === 'string') jsonLdTypes.push(item['@type']);
        }
      }
    } catch {
      // Malformed JSON-LD is itself a finding; the type list simply stays short.
    }
  }

  return {
    title: firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description: meta(html, 'description'),
    canonical,
    robots: meta(html, 'robots'),
    googlebot: meta(html, 'googlebot'),
    hreflang,
    og: {
      title: meta(html, 'og:title'),
      description: meta(html, 'og:description'),
      image: meta(html, 'og:image'),
      url: meta(html, 'og:url'),
      type: meta(html, 'og:type'),
      locale: meta(html, 'og:locale'),
      siteName: meta(html, 'og:site_name'),
    },
    twitter: { card: meta(html, 'twitter:card'), image: meta(html, 'twitter:image') },
    jsonLdTypes,
    h1: firstMatch(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? null,
    verification: meta(html, 'google-site-verification'),
  };
}

export interface RobotsFacts {
  sitemaps: string[];
  disallowed: string[];
  blocksAll: boolean;
  /** Blocks JS/CSS that Googlebot needs to render the page. */
  blocksAssets: boolean;
  groups: { agents: string[]; allow: string[]; disallow: string[] }[];
}

export function parseRobotsTxt(text: string): RobotsFacts {
  const sitemaps: string[] = [];
  const groups: RobotsFacts['groups'] = [];
  let current: RobotsFacts['groups'][number] | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'sitemap') {
      sitemaps.push(value);
      continue;
    }
    if (key === 'user-agent') {
      const agent = value.toLowerCase();
      const existing = groups.find((g) => g.agents.includes(agent));
      current = existing ?? { agents: [], allow: [], disallow: [] };
      if (!existing) groups.push(current);
      current.agents.push(agent);
      continue;
    }
    if (!current) continue;
    if (key === 'allow') current.allow.push(value);
    if (key === 'disallow') current.disallow.push(value);
  }

  const starGroup = groups.find((g) => g.agents.includes('*'));
  const disallowed = starGroup?.disallow ?? [];

  return {
    sitemaps,
    disallowed,
    blocksAll: disallowed.some((rule) => rule === '/'),
    // `/_next/static` (the JS/CSS/fonts) must stay crawlable; `/_next/image`
    // and `/_next/webpack-hmr` are fine to exclude.
    blocksAssets: disallowed.some(
      (rule) => rule.includes('/_next/static') || rule.trim() === '/_next' || rule.trim() === '/_next/',
    ),
    groups,
  };
}

export interface SitemapFacts {
  kind: 'sitemapindex' | 'urlset' | 'unknown';
  locs: string[];
  /** Sitemapindex or urlset namespace missing / unparsable XML. */
  malformed: boolean;
}

export function parseSitemap(xml: string): SitemapFacts {
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decode(m[1]));
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const isUrlset = /<urlset[\s>]/i.test(xml);
  return {
    kind: isIndex ? 'sitemapindex' : isUrlset ? 'urlset' : 'unknown',
    locs,
    malformed: !isIndex && !isUrlset,
  };
}

export interface PageFacts {
  /** The URL that was requested. */
  url: string;
  /** The URL after redirects — what actually answered. */
  finalUrl: string;
  status: number;
  html: string;
  headers: Record<string, string>;
  /** Status the page is expected to answer with (200 for pages, 404 for probes). */
  expectedStatus?: number;
  /** When true, `noindex` is the correct answer and its absence is the failure. */
  expectNoindex?: boolean;
  /** Languages that must appear as reciprocal hreflang alternates. */
  locales?: string[];
}

function headerValue(headers: Record<string, string>, name: string): string | null {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : null;
}

function stripQueryAndSlash(value: string): string {
  const withoutHash = value.split('#')[0];
  const withoutQuery = withoutHash.split('?')[0];
  return withoutQuery.replace(/\/+$/, '') || '/';
}

/**
 * The crawler-facing judgement of one page. Deliberately conservative: only
 * things that genuinely block or misdirect indexing are `fail`; quality
 * signals (title length, missing H1) are `warn`.
 */
export function checkPage(facts: PageFacts): Check[] {
  const head = parseHead(facts.html);
  const expected = facts.expectedStatus ?? 200;
  const locales = facts.locales ?? ['ar', 'en'];
  const checks: Check[] = [];
  const push = (id: string, label: string, status: CheckStatus, detail: string) =>
    checks.push({ id, label, status, detail });

  push(
    'status',
    `HTTP ${expected}`,
    facts.status === expected ? 'pass' : 'fail',
    `answered ${facts.status}${facts.finalUrl !== facts.url ? ` after redirect to ${facts.finalUrl}` : ''}`,
  );

  const robotsHeader = headerValue(facts.headers, 'x-robots-tag') ?? '';
  const indexed = !(head.robots ?? '').includes('noindex') && !robotsHeader.includes('noindex');
  if (facts.expectNoindex) {
    push(
      'noindex',
      'noindex expected',
      indexed ? 'fail' : 'pass',
      indexed ? 'page is indexable but should not be' : head.robots ?? robotsHeader,
    );
  } else {
    push(
      'noindex',
      'indexable',
      indexed ? 'pass' : 'fail',
      indexed ? 'no noindex in meta or X-Robots-Tag' : head.robots || robotsHeader || 'noindex present',
    );
  }

  // A 404 has no canonical, no hreflang and no share card — expecting them
  // would be wrong. What matters there is the status and the noindex.
  const notFoundPage = expected === 404;
  if (notFoundPage) return checks;

  const origin = safeOrigin(facts.finalUrl);
  if (!head.canonical) {
    push('canonical', 'canonical', 'fail', 'no <link rel="canonical"> in the server HTML');
  } else {
    const absolute = /^https?:\/\//i.test(head.canonical);
    const sameOrigin = absolute && safeOrigin(head.canonical) === origin;
    const selfReferencing =
      absolute && stripQueryAndSlash(pathOf(head.canonical)) === stripQueryAndSlash(pathOf(facts.finalUrl));
    if (!absolute) {
      push('canonical', 'canonical', 'fail', `relative canonical "${head.canonical}" — set metadataBase/SITE_URL`);
    } else if (!sameOrigin) {
      push('canonical', 'canonical', 'fail', `points at another host: ${head.canonical}`);
    } else if (!selfReferencing) {
      push('canonical', 'canonical', 'fail', `not self-referencing: ${head.canonical} for ${facts.finalUrl}`);
    } else {
      push('canonical', 'canonical', 'pass', head.canonical);
    }
  }

  const missingLangs = locales.filter((l) => !head.hreflang[l]);
  push(
    'hreflang',
    'hreflang',
    missingLangs.length === 0 && head.hreflang['x-default'] ? 'pass' : missingLangs.length === 0 ? 'warn' : 'fail',
    missingLangs.length === 0
      ? head.hreflang['x-default']
        ? `${locales.join('/')} + x-default`
        : `${locales.join('/')} present, x-default missing`
      : `missing ${missingLangs.join(', ')}`,
  );

  push(
    'title',
    'title',
    head.title ? 'pass' : 'fail',
    head.title ? `${head.title} (${head.title.length} chars)` : 'missing <title>',
  );
  const description = head.description ?? '';
  push(
    'description',
    'meta description',
    description.length >= 70 && description.length <= 170 ? 'pass' : description ? 'warn' : 'fail',
    description ? `${description.length} chars` : 'missing',
  );

  const image = head.og.image ?? head.twitter.image;
  push(
    'og:image',
    'og:image',
    image && /^https?:\/\//i.test(image) ? 'pass' : image ? 'fail' : 'fail',
    image ? (image.startsWith('http') ? image : `not absolute: ${image}`) : 'no og:image / twitter:image',
  );
  push(
    'og:title',
    'og:title + og:description',
    head.og.title && head.og.description ? 'pass' : 'warn',
    head.og.title ? 'present' : 'missing',
  );
  push(
    'jsonld',
    'JSON-LD',
    head.jsonLdTypes.length > 0 ? 'pass' : 'warn',
    head.jsonLdTypes.length > 0 ? head.jsonLdTypes.join(', ') : 'no structured data emitted',
  );
  push(
    'h1',
    'H1 (thin-content signal)',
    head.h1 ? 'pass' : 'warn',
    head.h1 ? head.h1.slice(0, 60) : 'no <h1> rendered on the server',
  );

  return checks;
}

export function checkRobotsTxt(text: string, expectedOrigin: string): Check[] {
  const facts = parseRobotsTxt(text);
  const checks: Check[] = [];
  checks.push({
    id: 'robots.blocksAll',
    label: 'robots.txt allows crawling',
    status: facts.blocksAll ? 'fail' : 'pass',
    detail: facts.blocksAll ? 'Disallow: / blocks every crawler' : 'no global Disallow',
  });
  checks.push({
    id: 'robots.assets',
    label: 'robots.txt keeps JS/CSS crawlable',
    status: facts.blocksAssets ? 'fail' : 'pass',
    detail: facts.blocksAssets ? '/_next/static is blocked — Google cannot render the pages' : '/_next/static reachable',
  });
  const expectedSitemap = `${expectedOrigin}/sitemap.xml`;
  const declares = facts.sitemaps.some((s) => s.replace(/\/+$/, '') === expectedSitemap);
  checks.push({
    id: 'robots.sitemap',
    label: 'robots.txt declares the sitemap',
    status: declares ? 'pass' : 'fail',
    detail: declares ? expectedSitemap : `expected ${expectedSitemap}, found ${facts.sitemaps.join(', ') || 'none'}`,
  });
  return checks;
}

export function checkSitemapIndex(xml: string, expectedOrigin: string): Check[] {
  const facts = parseSitemap(xml);
  const checks: Check[] = [];
  checks.push({
    id: 'sitemap.kind',
    label: 'sitemap.xml is valid XML',
    status: facts.malformed ? 'fail' : 'pass',
    detail: facts.malformed ? 'neither <urlset> nor <sitemapindex>' : `${facts.kind} with ${facts.locs.length} entries`,
  });
  const offsite = facts.locs.filter((loc) => !loc.startsWith(expectedOrigin));
  checks.push({
    id: 'sitemap.origin',
    label: 'sitemap URLs use the canonical host',
    status: offsite.length === 0 ? 'pass' : 'fail',
    detail: offsite.length === 0 ? 'all absolute and on-site' : `${offsite.length} off-host, e.g. ${offsite[0]}`,
  });
  return checks;
}

export function safeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

export function pathOf(value: string): string {
  try {
    return new URL(value).pathname;
  } catch {
    return value.split('?')[0];
  }
}

export function summarize(checks: Check[]): { pass: number; warn: number; fail: number } {
  return {
    pass: checks.filter((c) => c.status === 'pass').length,
    warn: checks.filter((c) => c.status === 'warn').length,
    fail: checks.filter((c) => c.status === 'fail').length,
  };
}

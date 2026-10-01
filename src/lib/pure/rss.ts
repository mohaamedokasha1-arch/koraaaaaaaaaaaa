/**
 * RSS 2.0 / Atom parsing helpers — pure, alias-free, unit-tested.
 *
 * Everything from a feed is treated as untrusted text: tags are stripped,
 * entities decoded, lengths capped and links restricted to the feed's own host,
 * so feed content cannot inject markup or hijack an outbound link.
 */
export interface FeedItem {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceUrl: string;
  publishedAt: string | null;
  excerpt: string;
  /**
   * Image declared by the feed. Only ever surfaced when the source directory
   * confirms the publisher permits image display (`imagesAllowed`); otherwise it
   * stays unused. Null is the honest default.
   */
  imageUrl?: string | null;
}

export interface FeedConfig {
  name: string;
  url: string;
  homepage?: string;
}

const MAX_ITEMS_PER_FEED = 20;
const MAX_TITLE = 180;
const MAX_EXCERPT = 220;

export interface FeedConfig {
  name: string;
  url: string;
  /** Optional override of the display label; defaults to the feed host. */
  homepage?: string;
  /**
   * Extra hosts this publisher legitimately serves articles from, e.g. a BBC
   * feed on feeds.bbci.co.uk links to www.bbc.co.uk. Explicit is the whole
   * point: no heuristic guessing about which third-party host is trustworthy.
   */
  allowedHosts?: string[];
  /** True only when the publisher's terms were verified to allow image display. */
  imagesAllowed?: boolean;
}

/** Parse `Label|https://feed[|Homepage[|host1;host2]]` into feed configs. */
export function parseFeedConfig(raw: string | undefined): FeedConfig[] {
  if (!raw) return [];
  const feeds: FeedConfig[] = [];
  for (const part of raw.split(',')) {
    const [label, url, homepage, hosts] = part.split('|').map((s) => s?.trim());
    if (!label || !url) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue;
      const allowedHosts = hosts
        ? hosts.split(';').map((h) => h.trim().toLowerCase()).filter(Boolean)
        : undefined;
      feeds.push({
        name: label,
        url: parsed.toString(),
        homepage: homepage || `${parsed.protocol}//${parsed.host}`,
        allowedHosts,
      });
    } catch {
      continue;
    }
  }
  return feeds;
}

function decodeEntities(input: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
    laquo: '«', raquo: '»', copy: '©', eacute: 'é', egue: 'è', uuml: 'ü', ouml: 'ö', auml: 'ä',
  };
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      const n = parseInt(code.slice(2), 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    if (code.startsWith('#')) {
      const n = parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return named[code.toLowerCase()] ?? match;
  });
}

/** Strip any markup/script payload and normalise whitespace. */
export function sanitizeFeedText(input: string | undefined, maxLength: number): string {
  if (!input) return '';
  const withoutCdata = input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const withoutTags = withoutCdata
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  const decoded = decodeEntities(withoutTags)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return decoded.length <= maxLength ? decoded : `${decoded.slice(0, maxLength - 1).trimEnd()}…`;
}

function tag(block: string, names: string[]): string | undefined {
  for (const name of names) {
    const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i');
    const m = re.exec(block);
    if (m) return m[1];
    const selfClosing = new RegExp(`<${name}[^>]*href=["']([^"']+)["'][^>]*/?>`, 'i');
    const sc = selfClosing.exec(block);
    if (sc) return sc[1];
  }
  return undefined;
}

/** Extract items from a raw RSS/Atom document. Pure — unit-tested. */
export function parseFeed(xml: string, feed: FeedConfig): FeedItem[] {
  const blocks = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map((m) => m[0]);
  const entries = blocks.length > 0 ? blocks : [...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)].map((m) => m[0]);
  const feedHost = safeHost(feed.url);
  const items: FeedItem[] = [];

  for (const block of entries.slice(0, MAX_ITEMS_PER_FEED * 2)) {
    const title = sanitizeFeedText(tag(block, ['title']), MAX_TITLE);
    const link = safeLink(tag(block, ['link', 'guid', 'id']), feedHost, feed.allowedHosts);
    if (!title || !link) continue;

    const published = sanitizeFeedText(tag(block, ['pubDate', 'published', 'updated', 'dc:date']), 60);
    const excerpt = sanitizeFeedText(
      tag(block, ['description', 'summary', 'content:encoded', 'content']),
      MAX_EXCERPT,
    );

    const image = safeImage(
      mediaUrl(block) ?? undefined,
      feedHost,
      feed.allowedHosts,
      feed.imagesAllowed,
    );

    items.push({
      id: stableId(link),
      title,
      url: link,
      source: feed.name,
      sourceUrl: feed.homepage ?? `${new URL(feed.url).protocol}//${feedHost}`,
      publishedAt: toIso(published),
      excerpt: excerpt === title ? '' : excerpt,
      imageUrl: image,
    });
    if (items.length >= MAX_ITEMS_PER_FEED) break;
  }
  return items;
}

/** First image the item declares (media:content / media:thumbnail / enclosure). */
function mediaUrl(block: string): string | null {
  const patterns = [
    /<media:content[^>]*url=["']([^"']+)["'][^>]*>/i,
    /<media:thumbnail[^>]*url=["']([^"']+)["'][^>]*>/i,
    /<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image\/[^"']*["'][^>]*>/i,
    /<enclosure[^>]*type=["']image\/[^"']*["'][^>]*url=["']([^"']+)["'][^>]*>/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(block);
    if (match) {
      const decoded = decodeEntities(match[1]).trim();
      if (decoded.startsWith('http')) return decoded;
    }
  }
  return null;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Only http(s) links on the publisher's own hosts are accepted.
 *
 * SECURITY (fixes the previous `endsWith(root)` check, which accepted ANY
 * `*.co.uk` link for a feed hosted on feeds.bbci.co.uk, and `evilexample.com`
 * for rss.example.com): a host now matches only on a dot boundary, and when the
 * operator supplies an explicit allow-list that list alone decides.
 */
export function isAllowedLinkHost(host: string, feedHost: string, allowedHosts?: string[]): boolean {
  const normalized = host.toLowerCase().replace(/\.$/, '');
  if (!normalized) return false;
  if (allowedHosts && allowedHosts.length > 0) {
    return allowedHosts.some(
      (allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`),
    );
  }
  if (!feedHost) return false;
  if (normalized === feedHost || normalized.endsWith(`.${feedHost}`)) return true;
  if (feedHost.endsWith(`.${normalized}`)) return true; // feed on a subdomain of the site
  // Same publisher, different subdomain (feeds.example.com → www.example.com).
  // Whole registrable domains are compared — never a raw suffix — so
  // `evil.co.uk` can never match `bbci.co.uk`.
  const feedDomain = registrableDomain(feedHost);
  return Boolean(feedDomain) && registrableDomain(normalized) === feedDomain;
}

/** Multi-label public suffixes we actually meet in sports feeds. */
const TWO_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'net.uk', 'sch.uk',
  'com.au', 'net.au', 'org.au', 'co.nz', 'co.jp', 'ne.jp', 'or.jp',
  'com.br', 'com.mx', 'com.ar', 'com.tr', 'com.eg', 'com.sa', 'com.ae',
  'com.qa', 'com.kw', 'com.bh', 'com.om', 'com.jo', 'com.lb', 'com.ma',
  'com.dz', 'com.tn', 'com.ly', 'com.sd', 'com.ye', 'com.iq', 'com.ng',
  'co.za', 'co.ke', 'co.il', 'co.in', 'com.pk', 'com.bd', 'com.my',
  'com.sg', 'co.kr', 'com.tw', 'com.hk', 'com.ph', 'com.vn',
]);

export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/\.$/, '').split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const lastTwo = parts.slice(-2).join('.');
  return TWO_PART_SUFFIXES.has(lastTwo) ? parts.slice(-3).join('.') : lastTwo;
}

function safeLink(raw: string | undefined, feedHost: string, allowedHosts?: string[]): string | null {
  if (!raw) return null;
  const value = sanitizeFeedText(raw, 500);
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!isAllowedLinkHost(url.host, feedHost, allowedHosts)) return null;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

/** Image URLs are held to the identical host policy as article links. */
function safeImage(raw: string | undefined, feedHost: string, allowedHosts?: string[], imagesAllowed?: boolean): string | null {
  if (!raw || !imagesAllowed) return null;
  const value = sanitizeFeedText(raw, 500);
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (!isAllowedLinkHost(url.host, feedHost, allowedHosts)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** ISO date or null — never a fabricated timestamp. */
export function toIso(value: string): string | null {
  if (!value) return null;
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return null;
  const iso = new Date(ts).toISOString();
  // Reject obviously bogus dates (feeds occasionally emit year 0001).
  return ts > Date.UTC(1990, 0, 1) && ts < Date.now() + 36 * 3600 * 1000 ? iso : null;
}

function stableId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i += 1) {
    hash = (hash * 31 + url.charCodeAt(i)) | 0;
  }
  return `n${Math.abs(hash).toString(36)}`;
}


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
}

/** Parse `Label|https://feed,Label2|https://feed2` into feed configs. */
export function parseFeedConfig(raw: string | undefined): FeedConfig[] {
  if (!raw) return [];
  const feeds: FeedConfig[] = [];
  for (const part of raw.split(',')) {
    const [label, url, homepage] = part.split('|').map((s) => s?.trim());
    if (!label || !url) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue;
      feeds.push({ name: label, url: parsed.toString(), homepage: homepage || `${parsed.protocol}//${parsed.host}` });
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
    // eslint-disable-next-line no-control-regex
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
    const link = safeLink(tag(block, ['link', 'guid', 'id']), feedHost);
    if (!title || !link) continue;

    const published = sanitizeFeedText(tag(block, ['pubDate', 'published', 'updated', 'dc:date']), 60);
    const excerpt = sanitizeFeedText(
      tag(block, ['description', 'summary', 'content:encoded', 'content']),
      MAX_EXCERPT,
    );

    items.push({
      id: stableId(link),
      title,
      url: link,
      source: feed.name,
      sourceUrl: feed.homepage ?? `${new URL(feed.url).protocol}//${feedHost}`,
      publishedAt: toIso(published),
      excerpt: excerpt === title ? '' : excerpt,
    });
    if (items.length >= MAX_ITEMS_PER_FEED) break;
  }
  return items;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
}

/** Only http(s) links pointing at the feed's own host are accepted. */
function safeLink(raw: string | undefined, feedHost: string): string | null {
  if (!raw) return null;
  const value = sanitizeFeedText(raw, 500);
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.host.toLowerCase();
    const root = feedHost.split('.').slice(-2).join('.');
    if (feedHost && !host.endsWith(root)) return null;
    url.search = '';
    url.hash = '';
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


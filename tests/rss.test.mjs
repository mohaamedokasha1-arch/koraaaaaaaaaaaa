import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, parseFeedConfig, sanitizeFeedText, toIso } from '../src/lib/pure/rss.ts';

const FEED = { name: 'Example Sport', url: 'https://feeds.example.com/football.xml', homepage: 'https://example.com' };

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title><![CDATA[Al Ahly beat Zamalek in Cairo derby]]></title>
    <link>https://example.com/articles/ahly-zamalek?utm_source=rss#top</link>
    <pubDate>Wed, 30 Sep 2026 20:38:22 GMT</pubDate>
    <description><![CDATA[<p>Two goals &amp; a red card decided the derby.</p><script>alert(1)</script>]]></description>
  </item>
  <item>
    <title>Hostile &lt;script&gt; headline</title>
    <link>https://evil.example.net/steal</link>
    <pubDate>not a date</pubDate>
    <description>body</description>
  </item>
</channel></rss>`;

test('parses a feed into headlines with dates, credit and a clean excerpt', () => {
  const items = parseFeed(RSS, FEED);
  assert.equal(items.length, 1, 'off-host links must be dropped, never rendered');
  const [item] = items;
  assert.equal(item.title, 'Al Ahly beat Zamalek in Cairo derby');
  assert.equal(item.source, 'Example Sport');
  assert.equal(item.sourceUrl, 'https://example.com');
  assert.equal(item.publishedAt, '2026-09-30T20:38:22.000Z');
  assert.ok(!/<[^>]+>/.test(item.excerpt), 'markup must be stripped from excerpts');
  assert.ok(item.excerpt.includes('&'), 'entities must be decoded');
  assert.ok(!item.url.includes('utm_source'), 'tracking parameters are removed');
  assert.ok(!item.url.includes('#'), 'fragments are removed');
});

test('sanitizeFeedText removes scripts, tags and control characters', () => {
  const clean = sanitizeFeedText('<b>Goal</b><script>alert("x")</script>\u0000  now', 60);
  assert.equal(clean.includes('<'), false);
  assert.equal(clean.includes('script'), false);
  assert.ok(clean.startsWith('Goal'));
});

test('toIso rejects unusable and implausible dates instead of inventing them', () => {
  assert.equal(toIso(''), null);
  assert.equal(toIso('not a date'), null);
  assert.equal(toIso('0001-01-01T00:00:00Z'), null);
});

test('parseFeedConfig only accepts http(s) feeds and keeps the operator label', () => {
  const feeds = parseFeedConfig('BBC Sport|https://feeds.bbci.co.uk/sport/football/rss.xml,broken|javascript:alert(1)');
  assert.equal(feeds.length, 1);
  assert.equal(feeds[0].name, 'BBC Sport');
  assert.equal(feeds[0].homepage, 'https://feeds.bbci.co.uk');
  assert.deepEqual(parseFeedConfig(undefined), []);
});

test('SECURITY: off-site links are rejected on a dot boundary, not a suffix match', () => {
  const feed = { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' };

  // Regression cases for the previous endsWith(root) check:
  const evil = `<item><title>Hostile</title><link>https://evil.co.uk/steal</link></item>
    <item><title>Brandalike</title><link>https://evilexample.com/steal</link></item>
    <item><title>Subdomain lookalike</title><link>https://evilbbci.co.uk/steal</link></item>
    <item><title>Same host</title><link>https://feeds.bbci.co.uk/ok/1</link></item>`;
  const items = parseFeed(`<rss><channel>${evil}</channel></rss>`, feed);
  assert.deepEqual(items.map((i) => i.url), ['https://feeds.bbci.co.uk/ok/1']);

  // A publisher whose articles live on another of its own hosts must be
  // configured explicitly — no guessing.
  const bbc = {
    name: 'BBC Sport',
    url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
    allowedHosts: ['bbc.co.uk', 'bbci.co.uk'],
  };
  const withAllowList = parseFeed(
    `<rss><channel><item><title>Real story</title><link>https://www.bbc.co.uk/sport/football/articles/abc</link></item>
     <item><title>Off-site</title><link>https://evil.co.uk/steal</link></item></channel></rss>`,
    bbc,
  );
  assert.equal(withAllowList.length, 1);
  assert.ok(withAllowList[0].url.startsWith('https://www.bbc.co.uk/'));
});

test('feed images are only surfaced when the source is verified to allow them', () => {
  const xml = `<rss><channel><item>
    <title>Story with a picture</title>
    <link>https://example.com/a</link>
    <media:content url="https://example.com/img/a.jpg" />
  </item></channel></rss>`;

  const closed = parseFeed(xml, { name: 'Example', url: 'https://example.com/rss' });
  assert.equal(closed[0].imageUrl, null, 'unverified sources never yield images');

  const allowed = parseFeed(xml, { name: 'Example', url: 'https://example.com/rss', imagesAllowed: true });
  assert.equal(allowed[0].imageUrl, 'https://example.com/img/a.jpg');

  const offsite = parseFeed(
    `<rss><channel><item><title>x</title><link>https://example.com/a</link>
     <media:content url="https://cdn.evil.net/a.jpg" /></item></channel></rss>`,
    { name: 'Example', url: 'https://example.com/rss', imagesAllowed: true },
  );
  assert.equal(offsite[0].imageUrl, null, 'images follow the same host policy as links');
});

test('parseFeedConfig carries an explicit host allow-list and homepage', () => {
  const feeds = parseFeedConfig('BBC Sport|https://feeds.bbci.co.uk/sport/football/rss.xml|https://www.bbc.co.uk/sport|bbc.co.uk;bbci.co.uk');
  assert.equal(feeds.length, 1);
  assert.deepEqual(feeds[0].allowedHosts, ['bbc.co.uk', 'bbci.co.uk']);
  assert.equal(feeds[0].homepage, 'https://www.bbc.co.uk/sport');
});

test('a feed may link to its own registrable domain but never to a lookalike', () => {
  const feed = { name: 'Example Sport', url: 'https://feeds.example.com/football.xml' };
  const items = parseFeed(
    `<rss><channel>
      <item><title>Same site</title><link>https://www.example.com/a</link></item>
      <item><title>Lookalike</title><link>https://evilexample.com/a</link></item>
      <item><title>Other suffix</title><link>https://evil.co.uk/a</link></item>
    </channel></rss>`,
    feed,
  );
  assert.deepEqual(items.map((i) => i.title), ['Same site']);

  const bbcFeed = { name: 'BBC', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' };
  const bbcItems = parseFeed(
    `<rss><channel><item><title>Other BBC brand host</title><link>https://www.bbc.co.uk/sport/x</link></item></channel></rss>`,
    bbcFeed,
  );
  assert.equal(bbcItems.length, 0, 'different registrable domain needs the explicit allow-list');
});

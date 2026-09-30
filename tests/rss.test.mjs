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

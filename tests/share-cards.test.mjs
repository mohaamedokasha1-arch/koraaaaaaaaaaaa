import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildShareCard, validCardMatchId, matchShareUrl, matchCardPath, cardText, cardUtcStamp, clipCardText, ogTextRuns, textDirection, hasOgTypography, socialShareUrls } from '../src/features/share-cards/lib/model.ts';
import { buildCardSvg, escapeXml, svgDataUrl } from '../src/features/share-cards/lib/svg.ts';
import { cardCopy } from '../src/features/share-cards/lib/copy.ts';
import { KORA_CARD_LOGO } from '../src/features/share-cards/lib/brand.ts';

// Synthetic validation snapshot only; not a production match/source.
const snapshot = (overrides = {}, envelope = {}) => ({ source: 'fd', stale: false, fetchedAt: '2026-10-02T18:45:00Z', data: {
  id: 'fd~990001', provider: 'fd', providerId: '990001', utcDate: '2026-10-02T19:00:00Z', status: 'live', minute: 70,
  home: { id: 'fd~1', name: 'الأهلي', shortName: null, crest: 'https://unlicensed.test/home.png' }, away: { id: 'fd~2', name: 'الزمالك', shortName: null, crest: 'https://unlicensed.test/away.png' },
  score: { home: 4, away: 2 }, league: { id: 'fd~PL', name: 'Isolated competition', code: 'PL', country: null, emblem: 'https://unlicensed.test/league.png' },
  events: [], lastUpdated: '2026-10-02T18:45:00Z', matchday: null, venue: null, referee: null, ...overrides,
}, ...envelope });

test('card variants are derived only from actual source status, including postponed/cancelled', () => {
  for (const [status, variant] of Object.entries({ finished: 'result', live: 'live', halftime: 'live', scheduled: 'fixture', postponed: 'fixture', cancelled: 'fixture' }))
    assert.equal(buildShareCard(snapshot({ status }), 'en').variant, variant);
  assert.equal(buildShareCard(snapshot({ status: 'invented' }), 'en'), null);
});
test('upcoming cards never turn adapter zeros into a played0-0 score', () => {
  const card = buildShareCard(snapshot({ status: 'scheduled', score: { home: 0, away: 0, htHome: 0, htAway: 0 } }), 'en');
  assert.equal(card.home.score, null); assert.equal(card.away.score, null); assert.equal(card.secondaryScore, null);
  assert.equal(card.kickoffTime, '19:00 UTC');
});
test('real zero and incomplete source scores survive without inference from events', () => {
  const card = buildShareCard(snapshot({ status: 'finished', score: { home: 0, away: null } }), 'en');
  assert.equal(card.home.score, 0); assert.equal(card.away.score, null);
  assert.equal(buildShareCard(snapshot({ score: { home: NaN, away: -1 } }), 'en').home.score, null);
});
test('half-time/penalty numeric details appear only when both source values exist', () => {
  assert.equal(buildShareCard(snapshot({ score: { home: 1, away: 1, htHome: 1 } }), 'en').secondaryScore, null);
  assert.equal(buildShareCard(snapshot({ score: { home: 1, away: 1, htHome: 1, htAway: 0 } }), 'en').secondaryScore, 'Half time: 1 – 0');
  assert.equal(buildShareCard(snapshot({ score: { home: 1, away: 1, pensHome: 4, pensAway: 3 } }), 'ar').secondaryScore, 'ركلات الترجيح: 3 – 4');
});
test('snapshot keeps source provenance and real fetched time even when served by cache', () => {
  const card = buildShareCard(snapshot({}, { source: 'cache', stale: true }), 'en');
  assert.equal(card.source, 'football-data.org'); assert.equal(card.stale, true); assert.equal(card.fetchedAt, '2026-10-02T18:45:00.000Z');
  assert.equal(card.snapshotTime, '2026-10-02 18:45 UTC');
  assert.equal(buildShareCard(snapshot({ provider: 'toString' }, { source: 'cache' }), 'en').source, 'toString');
});
test('a live clock/minute is never advanced from wall time or derived for half time', () => {
  assert.equal(buildShareCard(snapshot({ minute: null }), 'en').statusLabel, 'Live');
  assert.equal(buildShareCard(snapshot({ minute: 0 }), 'en').statusLabel, "Live · 0'");
  assert.equal(buildShareCard(snapshot({ status: 'halftime', minute: 48 }), 'en').statusLabel, 'Half time');
});
test('UTC formatting is explicit; invalid/missing timestamps are not substituted with now', () => {
  assert.equal(cardUtcStamp('2026-10-02T22:00:00+03:00'), '2026-10-02 19:00 UTC');
  assert.equal(cardUtcStamp('2026-10-02T22:00:00'), null); assert.equal(cardUtcStamp('not a date'), null);
  assert.equal(buildShareCard(snapshot({}, { fetchedAt: '' }), 'en').snapshotTime, 'Unavailable');
});
test('only safe supported provider IDs can reach the image endpoint, never arbitrary paths/URLs', () => {
  for (const id of ['fd~123', 'af~45', 'tsdb~234', 'espn~eng.1~123456']) assert.equal(validCardMatchId(id), true);
  for (const id of ['fd~0', 'fd~../123', 'espn~../evil~1', 'https://evil.test', 'fd~123?key=secret', 'fd~' + '1'.repeat(40), 'unknown~123', 'espn~eng..1~123']) assert.equal(validCardMatchId(id), false);
});
test('share links use the real browser origin and locale and do not carry query/personalisation data', () => {
  assert.equal(matchShareUrl('fd~123', 'ar', 'https://3000-sandbox.e2b.app'), 'https://3000-sandbox.e2b.app/ar/matches/fd~123');
  assert.equal(matchCardPath('fd~123', 'en'), '/en/matches/fd~123');
  for (const origin of ['javascript:alert(1)', 'https://user:password@site.test', 'https://site.test/?favorites=x', 'https://site.test/path', 'not a URL']) assert.equal(matchShareUrl('fd~123', 'ar', origin), null);
  assert.equal(matchShareUrl('bad', 'en', 'https://site.test'), null);
});
test('minimal card props never contain external art, player events, private preferences or synthetic stats', () => {
  const card = buildShareCard(snapshot(), 'ar'); const json = JSON.stringify(card);
  assert.equal(json.includes('unlicensed.test'), false); assert.equal('events' in card, false);
  for (const field of ['possession', 'shots', 'corners', 'ratings', 'lineup', 'favorites']) assert.equal(field in card, false);
});
test('SVG reuses the exact site brand and contains no external resources/scripts/foreign objects', () => {
  assert.equal(KORA_CARD_LOGO, readFileSync(new URL('../src/app/icon.svg', import.meta.url), 'utf8').trim());
  const svg = buildCardSvg(buildShareCard(snapshot(), 'ar'), 'https://site.test/ar/matches/fd~990001');
  assert.match(svg, /width="1200" height="630"/); assert.match(svg, /KoraScore/);
  assert.doesNotMatch(svg, /<script|<foreignObject|<image\b|\bhref=|@font-face|unlicensed\.test/);
});
test('untrusted source text is XML escaped, never SVG/JS markup', () => {
  const card = buildShareCard(snapshot({ home: { id: 'fd~1', name: '<image onload="evil()"> & الأهلي', shortName: null, crest: null } }), 'ar');
  const svg = buildCardSvg(card);
  assert.match(svg, /&lt;image onload=&quot;evil\(\)&quot;&gt;/); assert.doesNotMatch(svg, /<image\b/);
  assert.equal(escapeXml(`<>&"'`), '&lt;&gt;&amp;&quot;&apos;');
});
test('names remove controls and lone surrogates without breaking Arabic grapheme clusters', () => {
  assert.equal(cardText('الأهلي\u202e\u0000'), 'الأهلي'); assert.equal(cardText('\ud800'), '\ufffd');
  assert.equal(cardText('\ufffe\uffff'), '');
  const clipped = clipCardText('عِ'.repeat(40), 6); assert.equal(clipped, 'عِ'.repeat(5) + '…');
  assert.doesNotThrow(() => svgDataUrl(buildCardSvg(buildShareCard(snapshot({ home: { id: 'fd~1', name: '\ud800club', shortName: null, crest: null } }), 'en'))));
});
test('Arabic cards place home on the right, with score sides matching team sides', () => {
  const svg = buildCardSvg(buildShareCard(snapshot(), 'ar'));
  assert.match(svg, /x="650" y="315"[^>]*>4<\/text>/); assert.match(svg, /x="550" y="315"[^>]*>2<\/text>/);
  assert.equal(textDirection('الأهلي'), 'rtl'); assert.equal(textDirection('Manchester United'), 'ltr');
});
test('OG layout preserves RTL word sequence, individual shaping and intact Latin runs', () => {
  assert.deepEqual(ogTextRuns('عِش المباراة'), { rtl: true, parts: ['عِش', 'المباراة'] });
  assert.deepEqual(ogTextRuns('نادي Manchester United'), { rtl: true, parts: ['نادي', 'Manchester United'] });
  assert.deepEqual(ogTextRuns('Manchester United'), { rtl: false, parts: ['Manchester United'] });
  assert.deepEqual(ogTextRuns('Team نادي مدريد'), { rtl: false, parts: ['Team', 'مدريد', 'نادي'] });
});
test('SVG and model disclose cache/still-image limitations; AR/EN have complete status labels', () => {
  const svg = buildCardSvg(buildShareCard(snapshot({}, { stale: true }), 'en'));
  assert.match(svg, /Cached data/); assert.match(svg, /do not update automatically/);
  assert.deepEqual(Object.keys(cardCopy('ar').statuses), Object.keys(cardCopy('en').statuses));
  assert.deepEqual(Object.keys(cardCopy('ar')), Object.keys(cardCopy('en')));
});

test('Arabic UTC timestamps and secondary scores are isolated LTR text, not reversed within RTL captions', () => {
  const svg = buildCardSvg(buildShareCard(snapshot({ score: { home: 4, away: 2, htHome: 1, htAway: 0 } }), 'ar'));
  assert.match(svg, /x="600" y="475"[^>]*direction="ltr"[^>]*>2026-10-02 19:00 UTC<\/text>/);
  assert.match(svg, /x="535" y="411"[^>]*direction="ltr"[^>]*>0 – 1<\/text>/);
});
test('supported local glyphs render; unsupported scripts/emoji use generic metadata, not a remote font service', () => {
  assert.equal(hasOgTypography(buildShareCard(snapshot(), 'ar')), true);
  assert.equal(hasOgTypography(buildShareCard(snapshot(), 'en')), true);
  assert.equal(hasOgTypography(buildShareCard(snapshot({ home: { id: 'fd~1', name: '東京 FC', shortName: null, crest: null } }), 'en')), false);
  assert.equal(hasOgTypography(buildShareCard(snapshot({ home: { id: 'fd~1', name: '😀 club', shortName: null, crest: null } }), 'en')), false);
});
test('social links encode the validated actual public URL without scripts or SDKs', () => {
  const url = matchShareUrl('espn~eng.1~123', 'ar', 'https://site.test');
  const social = socialShareUrls(url);
  assert.equal(new URL(social.facebook).searchParams.get('u'), url);
  assert.equal(new URL(social.x).searchParams.get('url'), url);
});

test('licensed local OG fonts are pinned to the cmap/RTL tested files and ship the OFL licence', () => {
  for (const [name, hash] of [
    ['Arabic', '011a34e9bce80078231d12f8603721d0f99963b7104df560970fb754306ac359'],
    ['Latin', '31a473958608f90fdb257e924b554f67359c8f5f797f1b9cd0b69518b965d25c'],
  ]) assert.equal(createHash('sha256').update(readFileSync(new URL(`../src/features/share-cards/assets/Tajawal-${name}.woff`, import.meta.url))).digest('hex'), hash);
  assert.match(readFileSync(new URL('../src/features/share-cards/assets/OFL.txt', import.meta.url), 'utf8'), /SIL OPEN FONT LICENSE Version 1.1/);
});

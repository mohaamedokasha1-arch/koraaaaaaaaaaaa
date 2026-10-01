import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectLanguage,
  canonicalTitle,
  titleSimilarity,
  canonicalUrl,
  classifyNews,
  hubCategory,
  isSameStory,
  clusterStories,
  dedupeItems,
  footballRelevance,
  linkEntities,
} from '../src/lib/pure/newsIntel.ts';

function item(overrides = {}) {
  return {
    id: 'n1',
    title: 'Al Ahly beat Zamalek in Cairo derby',
    url: 'https://example.com/a',
    source: 'Example',
    sourceUrl: 'https://example.com',
    publishedAt: '2026-10-01T18:00:00Z',
    excerpt: '',
    language: 'en',
    category: 'match',
    entities: ['Al Ahly', 'Zamalek'],
    entityIds: ['team:al-ahly-eg', 'team:zamalek-eg'],
    hub: 'egypt',
    ...overrides,
  };
}

test('language detection separates Arabic from English', () => {
  assert.equal(detectLanguage('الأهلي يفوز على الزمالك في قمة الدوري'), 'ar');
  assert.equal(detectLanguage('Al Ahly beat Zamalek'), 'en');
  assert.equal(detectLanguage('12345 !!!'), 'other');
});

test('canonicalTitle folds Arabic spelling and drops noise words', () => {
  assert.equal(canonicalTitle('الأهلى يفوز على الزمالك'), canonicalTitle('الاهلي يفوز على الزمالك'));
  const canonical = canonicalTitle('Al Ahly beat Zamalek in the Cairo derby');
  assert.ok(!canonical.includes(' the '));
  assert.ok(canonical.startsWith('al ahly'));
});

test('titleSimilarity ranks paraphrases of one story above different stories', () => {
  const a = 'Al Ahly beat Zamalek 2-1 in the Cairo derby';
  const b = 'Cairo derby: Al Ahly beat Zamalek 2-1';
  const c = 'Zamalek appoint new coach after derby defeat';
  assert.ok(titleSimilarity(a, b) > 0.6);
  assert.ok(titleSimilarity(a, b) > titleSimilarity(a, c));
});

test('canonicalUrl removes tracking parameters so the same article is one URL', () => {
  assert.equal(
    canonicalUrl('https://www.example.com/story?utm_source=rss&utm_campaign=x#top'),
    canonicalUrl('http://example.com/story'),
  );
});

test('classification recognises the news type from Arabic and English wording', () => {
  assert.equal(classifyNews('الأهلي يتعاقد مع مهاجم جديد'), 'transfer');
  assert.equal(classifyNews('Liverpool agree deal to sign midfielder'), 'transfer');
  assert.equal(classifyNews('إصابة قوية تُبعد نجم الزمالك شهرين'), 'injury');
  assert.equal(classifyNews('Real Madrid edge past Barcelona in El Clasico'), 'match');
  assert.equal(classifyNews('منتخب مصر يعلن قائمة المعسكر المقبل'), 'national');
  assert.equal(classifyNews('Preview of the week ahead'), 'general');
});

test('hub category maps a story to the right News Hub section', () => {
  assert.equal(hubCategory('الأهلي يهزم الزمالك'), 'egypt');
  assert.equal(hubCategory('Al Hilal signs a new striker'), 'arab');
  assert.equal(hubCategory('Manchester City found guilty'), 'england');
  assert.equal(hubCategory('Nothing recognisable here', [], 'en'), 'world');
});

test('one story published by many outlets clusters into a single story', () => {
  const items = [
    item({ id: 'a', title: 'Al Ahly beat Zamalek 2-1 in Cairo derby', url: 'https://a.com/1', source: 'A' }),
    item({ id: 'b', title: 'Cairo derby: Al Ahly beat Zamalek 2-1', url: 'https://b.com/2', source: 'B' }),
    item({ id: 'c', title: 'Al Ahly win Cairo derby against Zamalek 2-1', url: 'https://c.com/3', source: 'C' }),
  ];
  const clusters = clusterStories(items);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].items.length, 3);
  assert.equal(clusters[0].sources.length, 3);
  assert.equal(clusters[0].representative.id, 'a', 'the newest item represents the story');
});

test('two different stories about the same club are NOT merged', () => {
  const items = [
    item({ id: 'transfer', title: 'Al Ahly sign new striker from Pyramids', url: 'https://a.com/t', category: 'transfer', entities: ['Al Ahly'], entityIds: ['team:al-ahly-eg'] }),
    item({ id: 'injury', title: 'Al Ahly defender suffers injury in training', url: 'https://a.com/i', category: 'injury', entities: ['Al Ahly'], entityIds: ['team:al-ahly-eg'] }),
    item({ id: 'stadium', title: 'Al Ahly announce new stadium plans for 2027', url: 'https://a.com/s', category: 'general', entities: ['Al Ahly'], entityIds: ['team:al-ahly-eg'] }),
  ];
  const clusters = clusterStories(items);
  assert.equal(clusters.length, 3, 'clustering is by event, not by club');
});

test('the same real-life story in Arabic and English is detected within the window', () => {
  const en = item({
    id: 'en',
    title: 'Al Ahly beat Zamalek 2-1 in Cairo derby',
    url: 'https://en.com/1',
    language: 'en',
  });
  const ar = item({
    id: 'ar',
    title: 'الأهلي يهزم الزمالك 2-1 في قمة القاهرة',
    url: 'https://ar.com/1',
    language: 'ar',
    entities: ['الأهلي', 'الزمالك'],
    entityIds: ['team:al-ahly-eg', 'team:zamalek-eg'],
    publishedAt: '2026-10-01T18:20:00Z',
  });
  // Cross-language clustering is entity+category driven, so identical entity
  // sets and category are enough even when the words differ completely.
  assert.ok(isSameStory(en, ar, { entityThreshold: 0.4 }));
});

test('dedupeItems drops the same story from the same source but keeps other sources', () => {
  const items = [
    item({ id: 'a', url: 'https://a.com/1', source: 'A' }),
    item({ id: 'a2', url: 'https://a.com/1?utm_source=rss', source: 'A' }),
    item({ id: 'b', url: 'https://b.com/1', source: 'B' }),
  ];
  const out = dedupeItems(items);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((i) => i.source), ['A', 'B']);
});

test('linkEntities only links names that really appear in the text', () => {
  const hints = [
    { id: 'team:al-ahly-eg', names: ['Al Ahly', 'الأهلي'], country: 'Egypt' },
    { id: 'team:zamalek-eg', names: ['Zamalek', 'الزمالك'], country: 'Egypt' },
    { id: 'team:real-madrid-es', names: ['Real Madrid', 'ريال مدريد'], country: 'Spain' },
  ];
  const linked = linkEntities('الأهلي يفوز على الزمالك في القمة', hints);
  assert.deepEqual(linked.map((l) => l.id), ['team:al-ahly-eg', 'team:zamalek-eg']);
  assert.ok(!linked.some((l) => l.id === 'team:real-madrid-es'), 'no invented links');
});

test('stories outside the time window are not merged', () => {
  const fresh = item({ id: 'f', url: 'https://a.com/f', publishedAt: '2026-10-01T18:00:00Z' });
  const old = item({
    id: 'o',
    url: 'https://a.com/o',
    title: 'Al Ahly beat Zamalek in Cairo derby thriller',
    publishedAt: '2026-09-20T18:00:00Z',
    category: 'match',
  });
  assert.ok(!isSameStory(fresh, old, { titleThreshold: 0.99 }));
});

test('football gate keeps football, drops other sports, and keeps the uncertain', () => {
  // Football: a real competition, the sport itself, or a linked entity.
  assert.equal(footballRelevance('منتخب مصر يهزم تونس في تصفيات كأس أمم أفريقيا'), 'football');
  assert.equal(footballRelevance('Premier League title race tightens'), 'football');
  assert.equal(footballRelevance('خبر بلا كلمات مفتاحية', '', 2), 'football', 'linked entities prove relevance');

  // Other sports are dropped only when nothing football is present.
  assert.equal(footballRelevance('منتخب كرة اليد يفوز على الجزائر'), 'other');
  assert.equal(footballRelevance('Basketball league finals draw big audience'), 'other');

  // Uncertain items are kept (recall beats a tidy-looking hub).
  assert.equal(footballRelevance('الأهلي يستعد للقمة'), 'unknown');
  assert.equal(footballRelevance('بيان من النادي حول التذاكر'), 'unknown');
});

test('a handball item cannot slip through just because it says "دوري"', () => {
  // Both a generic football word and a clear other-sport word are present:
  // without a linked football entity and without a strong football term the
  // item belongs to another sport and must be dropped.
  assert.equal(footballRelevance('دوري السلة المصري ينطلق غدًا', 'منافسات قوية هذا الموسم'), 'other');
  // With the actual sport named, it is football again.
  assert.equal(footballRelevance('دوري كرة القدم المصري ينطلق غدًا'), 'football');
});

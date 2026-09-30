import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText, expandQuery, matchesQuery } from '../src/lib/pure/normalize.ts';

test('normalizeText folds hamza/taa-marbuta/diacritics and Arabic-Indic digits', () => {
  assert.equal(normalizeText('الأهلى'), normalizeText('الاهلي'));
  assert.equal(normalizeText('كأس مصر'), 'كاس مصر');
  assert.equal(normalizeText('مُحَمَّد'), 'محمد');
  assert.equal(normalizeText('٢٠٢٦'), '2026');
  assert.equal(normalizeText('Real  Madrid'), 'real madrid');
});

test('expandQuery resolves the Egyptian top clubs to their Latin provider names', () => {
  assert.ok(expandQuery('الأهلي').includes('Al Ahly'));
  assert.ok(expandQuery('الزمالك').includes('Zamalek'));
  assert.ok(expandQuery('بيراميدز').some((q) => /pyramids/i.test(q)));
  assert.deepEqual(expandQuery('a'), []);
});

test('matchesQuery tolerates spelling variants in both directions', () => {
  assert.ok(matchesQuery('Al Ahly SC', 'الاهلي'));
  assert.ok(matchesQuery('Ismaily', 'الإسماعيلي'));
  assert.ok(!matchesQuery('Zamalek', 'ريال مدريد'));
});

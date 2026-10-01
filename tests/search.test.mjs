import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText, expandQuery, matchesQuery, SEARCH_ALIASES } from '../src/lib/pure/normalize.ts';
import { foldText, scoreName, matchesEntity, ambiguityGroups, teamSlug } from '../src/lib/pure/entity.ts';

/**
 * Entity-aware search (Phase 4): the same club must be reachable through every
 * spelling users actually type — Arabic, Latin, with hamza variants, with typos
 * — while two different clubs that share a name stay separate options.
 */

test('Arabic orthographic variants fold to one search key', () => {
  assert.equal(normalizeText('الأهلي'), normalizeText('الاهلى'));
  assert.equal(normalizeText('بيراميدز'), normalizeText('بيراميدز'));
  assert.equal(normalizeText('۲۰۲۶'), '2026', 'Arabic-Indic digits normalise to Latin digits');
});

test('Arabic aliases expand to the Latin provider spellings', () => {
  const expansions = expandQuery('ريال مدريد');
  assert.ok(expansions.length > 1, 'aliases must expand the query');
  assert.ok(
    expansions.some((e) => normalizeText(e).includes('real madrid')),
    `expected Real Madrid in expansions, got ${JSON.stringify(expansions)}`,
  );
});

test('"الريال" finds Real Madrid through the alias table', () => {
  const hasAlias = Object.keys(SEARCH_ALIASES).some((key) => normalizeText(key) === normalizeText('الريال'));
  assert.ok(hasAlias, 'the nickname الريال must exist in the curated alias table');
  const expansions = expandQuery('الريال');
  assert.ok(expansions.length >= 1);
});

test('matchesQuery tolerates spelling differences in both directions', () => {
  assert.equal(matchesQuery('Al Ahly', 'الأهلي'), true);
  assert.equal(matchesQuery('الأهلي', 'Al Ahly'), true);
  assert.equal(matchesQuery('Barcelona', 'برشلونة'), true);
  assert.equal(matchesQuery('Barcelona', 'ريال مدريد'), false, 'different clubs must not match');
});

test('scoreName ranks exact and alias hits above fuzzy noise', () => {
  const ahly = { name: 'Al Ahly', nameAr: 'الأهلي', aliases: ['Al Ahly SC', 'الاهلي المصري'] };
  const exact = scoreName('Al Ahly', ahly);
  const alias = scoreName('الاهلي المصري', ahly);
  const other = scoreName('Zamalek', ahly);
  assert.equal(exact.score, 1);
  assert.ok(alias.score >= 0.9, `alias score too low: ${alias.score}`);
  assert.ok(other.score < 0.4, `unrelated name scored too high: ${other.score}`);
});

test('matchesEntity accepts real alternative names and rejects others', () => {
  const real = { name: 'Real Madrid', nameAr: 'ريال مدريد', aliases: ['ريال مدريد الإسباني', 'النادي الملكي'] };
  assert.equal(matchesEntity('ريال مدريد', real), true);
  assert.equal(matchesEntity('Barcelona', real), false);
});

test('two clubs sharing a name become explicit options, never a silent merge', () => {
  const groups = ambiguityGroups([
    { name: 'Al Ahly', country: 'Egypt' },
    { name: 'Al Ahly', country: 'Saudi Arabia' },
    { name: 'Zamalek', country: 'Egypt' },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].options.length, 2);
  assert.deepEqual(
    groups[0].options.map((o) => o.country).sort(),
    ['Egypt', 'Saudi Arabia'],
  );
});

test('team slugs are stable, URL-safe and country-scoped', () => {
  assert.equal(teamSlug('Al Ahly', 'eg'), 'al-ahly-eg');
  const arabicOnly = teamSlug('الأهلي', 'eg');
  assert.match(arabicOnly, /^[a-z0-9-]+$/);
  assert.equal(arabicOnly, teamSlug('الأهلي', 'eg'), 'same input → same slug (stable id)');
  assert.equal(foldText('El Gouna'), 'el gouna');
});

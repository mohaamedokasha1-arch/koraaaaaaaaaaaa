import test from 'node:test';
import assert from 'node:assert/strict';
import {
  foldText,
  nameForms,
  teamSlug,
  slugify,
  editDistance,
  scoreName,
  ambiguityGroups,
  shouldMerge,
  playerSlug,
} from '../src/lib/pure/entity.ts';

test('foldText folds Arabic spelling variants so الأهلى == الاهلي == الأهلي', () => {
  assert.equal(foldText('الأهلي'), foldText('الاهلى'));
  assert.equal(foldText('الأهلي'), 'الاهلي');
  assert.equal(foldText('مُحَمَّد'), 'محمد');
  assert.equal(foldText('٢٠٢٦'), '2026');
  assert.equal(foldText('Real  Madrid'), 'real madrid');
});

test('nameForms strips club affixes: Al Ahly SC == Al Ahly == Ahly', () => {
  const forms = nameForms('Al Ahly SC');
  assert.ok(forms.includes('al ahly'));
  assert.ok(forms.includes('ahly'), 'the Arabic definite article is not part of a name');
  assert.ok(nameForms('نادي الأهلي المصري').includes('الاهلي المصري'));
});

test('teamSlug is stable and country-suffixed when the country is known', () => {
  assert.equal(teamSlug('Al Ahly', 'EG'), 'al-ahly-eg');
  assert.equal(teamSlug('Al Ahly', 'SA'), 'al-ahly-sa');
  assert.notEqual(teamSlug('Al Ahly', 'EG'), teamSlug('Al Ahly', 'SA'));
  assert.match(slugify('الأهلي'), /^x[0-9a-z]+$/, 'Arabic-only names still get a stable, URL-safe slug');
});

test('scoreName recognises exact, alias and typo spellings, and stays strict otherwise', () => {
  const realMadrid = { name: 'Real Madrid', nameAr: 'ريال مدريد', aliases: ['الريال', 'Real Madrid CF'] };
  assert.ok(scoreName('ريال مدريد', realMadrid).score > 0.95);
  assert.ok(scoreName('Real Madrid', realMadrid).type === 'exact');
  assert.ok(scoreName('الريال', realMadrid).score > 0.9, 'nickname alias must resolve');
  assert.ok(scoreName('ريال مدريدd', realMadrid).score > 0.5, 'a one-character typo is tolerated');

  const ahly = { name: 'Al Ahly SC', nameAr: 'الأهلي المصري', aliases: ['Al Ahly', 'الاهلي'] };
  assert.ok(scoreName('Al Ahly', ahly).score > 0.9);
  assert.ok(scoreName('الأهلي', ahly).score > 0.9);
  assert.ok(scoreName('Ahly', ahly).score > 0.5);

  assert.ok(scoreName('Zamalek', realMadrid).score < 0.4, 'unrelated clubs must not match');
});

test('editDistance is bounded and exact for small typos', () => {
  assert.equal(editDistance('barcelona', 'barcelon', 2), 1);
  assert.equal(editDistance('barcelona', 'barcelona', 2), 0);
  assert.ok(editDistance('barcelona', 'juventus', 2) > 2);
});

test('ambiguityGroups separates same-name clubs in different countries and never merges them', () => {
  const groups = ambiguityGroups([
    { name: 'Al Ahly', country: 'Egypt' },
    { name: 'Al Ahly', country: 'Saudi Arabia' },
    { name: 'Zamalek', country: 'Egypt' },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].options.length, 2);
  assert.equal(groups[0].key, 'al ahly');
});

test('shouldMerge merges on a shared ref or same name+country, and refuses ambiguity', () => {
  const egyptian = {
    id: 'team:al-ahly-eg',
    kind: 'team',
    slug: 'al-ahly-eg',
    name: 'Al Ahly SC',
    nameAr: 'الأهلي المصري',
    shortName: null,
    country: 'Egypt',
    countryCode: 'EG',
    leagueCodes: ['EGY'],
    aliases: ['Al Ahly'],
    refs: [{ provider: 'tsdb', id: '138995' }],
    updatedAt: null,
  };

  assert.equal(
    shouldMerge({ name: 'Al Ahly SC', refs: [{ provider: 'tsdb', id: '138995' }] }, egyptian),
    'strong',
    'a shared provider ref proves identity',
  );
  assert.equal(shouldMerge({ name: 'Al Ahly', country: 'Egypt' }, egyptian), 'weak');
  assert.equal(shouldMerge({ name: 'Al Ahly', leagueCodes: ['EGY'] }, egyptian), 'weak');
  assert.equal(
    shouldMerge({ name: 'Al Ahly', country: 'Saudi Arabia' }, egyptian),
    null,
    'same name in another country must NOT auto-merge — it goes to human review',
  );
  assert.equal(shouldMerge({ name: 'Zamalek', country: 'Egypt' }, egyptian), null);
  assert.equal(
    shouldMerge({ name: 'Al Ahly SC' }, egyptian),
    null,
    'a bare name with no country/league/ref evidence is not enough to merge',
  );
});

test('playerSlug scopes a player to a team so namesakes do not collide', () => {
  assert.equal(playerSlug('Mohamed Salah', 'liverpool-eng'), 'mohamed-salah-liverpool-eng');
  assert.notEqual(playerSlug('Mohamed Salah', 'liverpool-eng'), playerSlug('Mohamed Salah', 'egypt-eg'));
});

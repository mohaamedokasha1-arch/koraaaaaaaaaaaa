import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_TEAMS, SEED_COUNTRIES } from '../src/lib/entities/seed.ts';

/**
 * The entity registry's seed is the part of the Knowledge Model that ships as
 * data: real clubs, real Arabic names, real external identifiers. These tests
 * protect data quality — no fabricated rows, no duplicate identities, and every
 * Wikidata reference well-formed — because a bad row here becomes a wrong page
 * everywhere downstream.
 */

const team = (name) => SEED_TEAMS.find((t) => t.name === name);

test('seed clubs are complete: name, country, country code and league codes', () => {
  assert.ok(SEED_TEAMS.length >= 30, `expected a substantial seed, got ${SEED_TEAMS.length}`);
  for (const t of SEED_TEAMS) {
    assert.ok(t.name && t.name.trim().length > 1, `bad name: ${JSON.stringify(t)}`);
    assert.ok(t.country && t.country.trim().length > 1, `${t.name}: missing country`);
    assert.ok(t.countryCode && /^[a-z]{2,3}$/.test(t.countryCode), `${t.name}: bad countryCode`);
    // Clubs outside the catalogue (e.g. Saudi/African sides not yet covered by
    // a provider league) are still valid entities: the field exists, and when
    // empty it means "no linked competition yet", never a fabricated one.
    assert.ok(Array.isArray(t.leagueCodes), `${t.name}: leagueCodes must be an array`);
  }
});

test('the same club is never seeded twice (name + country is unique)', () => {
  const seen = new Set();
  for (const t of SEED_TEAMS) {
    const key = `${t.name.trim().toLowerCase()}|${t.country}`;
    assert.ok(!seen.has(key), `duplicate seed row: ${key}`);
    seen.add(key);
  }
});

test('every club has at least one real alternative name (Arabic or alias)', () => {
  for (const t of SEED_TEAMS) {
    const alternatives = [...(t.aliases ?? [])];
    if (t.nameAr) alternatives.push(t.nameAr);
    assert.ok(alternatives.length >= 1, `${t.name}: no alternative names at all`);
  }
});

test('Al Ahly (Egypt) carries the verified Wikidata ref and Arabic aliases', () => {
  const ahly = team('Al Ahly');
  assert.ok(ahly, 'Al Ahly must exist in the seed');
  assert.equal(ahly.nameAr, 'الأهلي');
  assert.equal(ahly.countryCode, 'eg');
  assert.ok(ahly.leagueCodes.includes('EGY'));
  assert.ok(ahly.aliases.some((a) => a.includes('المارد الأحمر')), 'verified alias missing');
  assert.equal(ahly.wikidata, 'Q223566', 'Wikidata Q-id from the verified entity API call');
});

test('Wikidata references are well-formed when present, and absent rather than invented', () => {
  for (const t of SEED_TEAMS) {
    if (t.wikidata === undefined || t.wikidata === null) continue;
    assert.match(t.wikidata, /^Q\d+$/, `${t.name}: malformed Wikidata id ${t.wikidata}`);
  }
});

test('country seed is ISO-coded and unique', () => {
  assert.ok(SEED_COUNTRIES.length >= 12);
  const codes = new Set();
  for (const c of SEED_COUNTRIES) {
    assert.ok(c.name && c.nameAr, `country missing names: ${JSON.stringify(c)}`);
    assert.match(c.code, /^[a-z]{2,3}$/);
    assert.ok(!codes.has(c.code), `duplicate country code ${c.code}`);
    codes.add(c.code);
  }
});

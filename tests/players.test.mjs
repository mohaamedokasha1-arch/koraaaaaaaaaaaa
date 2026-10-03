import test from 'node:test';
import assert from 'node:assert/strict';
import { playerEntityId, decodePlayerId, findPlayerInTeam, ageFromBirthDate } from '../src/lib/players.ts';

test('playerEntityId builds a cosmetic-slug + resolvable id, and decodePlayerId recovers the team/person ids', () => {
  const id = playerEntityId('Mohamed Salah', 'fd~64', '3754');
  assert.equal(id, 'mohamed-salah~fd~64~3754');
  const decoded = decodePlayerId(id);
  assert.deepEqual(decoded, { teamId: 'fd~64', personId: '3754' });
});

test('decodePlayerId also resolves ids with no cosmetic slug at all', () => {
  assert.deepEqual(decodePlayerId('fd~64~3754'), { teamId: 'fd~64', personId: '3754' });
});

test('decodePlayerId rejects ids that cannot address a real team', () => {
  assert.equal(decodePlayerId('fd~64'), null);
  assert.equal(decodePlayerId(''), null);
  assert.equal(decodePlayerId('justaslug'), null);
});

test('findPlayerInTeam only ever returns a player actually present in that exact squad', () => {
  const team = {
    id: 'fd~64', provider: 'fd', providerId: '64', name: 'Liverpool', shortName: null, crest: null,
    country: null, founded: null, venue: null, website: null, coach: null, leagueCode: 'PL',
    squad: [
      { id: '3754', name: 'Mohamed Salah', position: 'Right Winger', nationality: 'Egypt', dateOfBirth: '1992-06-15', shirtNumber: 11 },
    ],
  };
  assert.equal(findPlayerInTeam(team, '3754')?.name, 'Mohamed Salah');
  assert.equal(findPlayerInTeam(team, '9999'), null);
});

test('ageFromBirthDate computes a correct whole-years age relative to "now"', () => {
  const now = new Date('2026-10-03T00:00:00Z');
  assert.equal(ageFromBirthDate('1992-06-15', now), 34);
  assert.equal(ageFromBirthDate('1992-12-15', now), 33); // birthday hasn't happened yet this year
  assert.equal(ageFromBirthDate(null, now), null);
  assert.equal(ageFromBirthDate('not-a-date', now), null);
});

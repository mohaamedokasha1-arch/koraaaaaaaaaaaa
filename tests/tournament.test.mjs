import test from 'node:test';
import assert from 'node:assert/strict';
import { mapTournamentStandings, roundSortKey, fallbackRoundLabel } from '../src/lib/pure/tournament.ts';

// Trimmed fixture shaped exactly like a real response from
// GET https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings?season=2026
// (captured live on 2026-10-03, see src/lib/pure/tournament.ts header comment).
const REAL_WORLD_CUP_FIXTURE = {
  children: [
    {
      id: '1',
      name: 'Group A',
      standings: {
        entries: [
          {
            team: { id: '203', displayName: 'Mexico', logos: [{ href: 'https://a.espncdn.com/i/teamlogos/countries/500/mex.png' }] },
            note: { description: 'Advance to Round of 32' },
            stats: [
              { type: 'gamesplayed', value: 3 },
              { type: 'wins', value: 3 },
              { type: 'ties', value: 0 },
              { type: 'losses', value: 0 },
              { type: 'pointsfor', value: 6 },
              { type: 'pointsagainst', value: 0 },
              { type: 'pointdifferential', value: 6 },
              { type: 'points', value: 9 },
              { type: 'rank', value: 1 },
            ],
          },
          {
            team: { id: '450', displayName: 'Czechia', logos: [{ href: 'https://a.espncdn.com/i/teamlogos/countries/500/cze.png' }] },
            note: { description: 'Eliminated' },
            stats: [
              { type: 'gamesplayed', value: 3 },
              { type: 'wins', value: 0 },
              { type: 'ties', value: 1 },
              { type: 'losses', value: 2 },
              { type: 'pointsfor', value: 2 },
              { type: 'pointsagainst', value: 6 },
              { type: 'pointdifferential', value: -4 },
              { type: 'points', value: 1 },
              { type: 'rank', value: 4 },
            ],
          },
        ],
      },
    },
  ],
};

test('mapTournamentStandings turns a real ESPN tournament-standings payload into flat, group-tagged rows', () => {
  const rows = mapTournamentStandings(REAL_WORLD_CUP_FIXTURE, (teamId) => `espn~${teamId}`);
  assert.equal(rows.length, 2);

  const mexico = rows.find((r) => r.team.name === 'Mexico');
  assert.ok(mexico);
  assert.equal(mexico.team.id, 'espn~203');
  assert.equal(mexico.group, 'Group A');
  assert.equal(mexico.position, 1);
  assert.equal(mexico.played, 3);
  assert.equal(mexico.won, 3);
  assert.equal(mexico.points, 9);
  assert.equal(mexico.goalDifference, 6);
  assert.equal(mexico.note, 'Advance to Round of 32');

  const czechia = rows.find((r) => r.team.name === 'Czechia');
  assert.equal(czechia.note, 'Eliminated');
  assert.equal(czechia.lost, 2);
});

test('mapTournamentStandings never invents a row: a team missing an id is skipped, not guessed', () => {
  const rows = mapTournamentStandings({ children: [{ name: 'Group Z', standings: { entries: [{ team: { displayName: 'Ghost FC' } }] } }] }, (id) => id);
  assert.deepEqual(rows, []);
});

test('mapTournamentStandings on an empty/unknown payload yields no rows (no fabricated data)', () => {
  assert.deepEqual(mapTournamentStandings({}, (id) => id), []);
});

test('roundSortKey orders real tournament rounds group-stage to final', () => {
  const slugs = ['final', 'group-stage', 'semifinals', 'round-of-16', 'quarterfinals', 'round-of-32', 'third-place'];
  const sorted = [...slugs].sort((a, b) => roundSortKey(a) - roundSortKey(b));
  assert.deepEqual(sorted, ['group-stage', 'round-of-32', 'round-of-16', 'quarterfinals', 'semifinals', 'third-place', 'final']);
});

test('roundSortKey puts an unrecognised round after every known round, never fabricating a position', () => {
  const known = roundSortKey('final');
  const unknown = roundSortKey('some-future-espn-round-slug');
  assert.ok(unknown > known);
  assert.equal(roundSortKey(null), unknown + 1);
});

test('fallbackRoundLabel turns an ESPN slug into a readable title when no i18n mapping exists yet', () => {
  assert.equal(fallbackRoundLabel('round-of-32'), 'Round Of 32');
  assert.equal(fallbackRoundLabel('third-place'), 'Third Place');
});

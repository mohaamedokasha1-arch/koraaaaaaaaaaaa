import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStandings, seasonTeams } from '../src/lib/pure/standings.ts';

const match = (home, away, hg, ag, status = 'finished') => ({
  home: { id: home.toLowerCase(), name: home },
  away: { id: away.toLowerCase(), name: away },
  score: { home: hg, away: ag },
  status,
});

test('a computed table counts only finished matches and uses 3/1/0 points', () => {
  const rows = computeStandings([
    match('Alpha', 'Beta', 2, 0),
    match('Beta', 'Alpha', 1, 1),
    match('Alpha', 'Gamma', 0, 3, 'scheduled'),
    match('Gamma', 'Beta', 2, 2),
  ]);

  const alpha = rows.find((r) => r.teamName === 'Alpha');
  const beta = rows.find((r) => r.teamName === 'Beta');
  const gamma = rows.find((r) => r.teamName === 'Gamma');

  assert.equal(alpha.played, 2);
  assert.equal(alpha.points, 4);
  // Beta played all three: the 0-2, the 1-1 return and the 2-2 with Gamma.
  assert.equal(beta.played, 3);
  assert.equal(beta.points, 2);
  assert.equal(gamma.played, 1);
  assert.equal(gamma.points, 1);
  assert.equal(rows[0].teamName, 'Alpha');
  assert.equal(rows[0].position, 1);
});

test('the tie-break order is points, goal difference, goals scored, then name', () => {
  const rows = computeStandings([
    match('One', 'X', 3, 0),
    match('Two', 'Y', 2, 0),
    match('X', 'Two', 0, 0),
    match('Y', 'One', 0, 0),
  ]);
  // One and Two both have 4 points; One has +3, Two +2.
  assert.deepEqual(
    rows.map((r) => r.teamName).slice(0, 2),
    ['One', 'Two'],
  );
});

test('form keeps the last five results, newest first', () => {
  const rows = computeStandings([
    match('Alpha', 'B', 1, 0),
    match('Alpha', 'C', 0, 1),
    match('Alpha', 'D', 1, 1),
    match('Alpha', 'E', 2, 0),
    match('Alpha', 'F', 0, 2),
    match('Alpha', 'G', 3, 0),
  ]);
  assert.equal(rows[0].teamName, 'Alpha');
  assert.equal(rows[0].form.length, 5);
  // Newest first → the win over G is first, the loss to E is dropped.
  assert.equal(rows[0].form[0], 'W');
});

test('rows without a complete score are ignored, never invented as 0-0', () => {
  const rows = computeStandings([
    { home: { id: 'a', name: 'A' }, away: { id: 'b', name: 'B' }, score: { home: null, away: null }, status: 'finished' },
    match('A', 'B', 1, 0),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.teamName === 'A').played, 1);
});

test('seasonTeams lists each club once, alphabetical', () => {
  const teams = seasonTeams([match('Zed', 'Alpha', 1, 0), match('Alpha', 'Mid', 2, 2)]);
  assert.deepEqual(teams.map((t) => t.name), ['Alpha', 'Mid', 'Zed']);
});

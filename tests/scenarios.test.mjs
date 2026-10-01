import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reconcileMatch,
  canTransition,
  isStuckLive,
  validateMatch,
  pickField,
} from '../src/lib/pure/validation.ts';

/**
 * Failure scenarios (Phase 8, operational review). Each test reproduces a real
 * production incident the platform must survive without showing wrong data:
 *
 *   1. a provider goes down and comes back with an old snapshot,
 *   2. two providers disagree about the same fixture,
 *   3. a provider returns corrupt values,
 *   4. a status regresses (finished → live),
 *   5. a live match freezes and never updates,
 *   6. a partial provider tries to blank fields it does not have.
 */

const fixture = (over = {}) => ({
  id: 'fd~123',
  status: 'live',
  home: { id: 'h', name: 'Al Ahly' },
  away: { id: 'a', name: 'Zamalek' },
  score: { home: 1, away: 0 },
  utcDate: '2026-10-01T18:00:00Z',
  ...over,
});

test('scenario: a stale snapshot never overwrites a fresher one', () => {
  const existing = {
    ...fixture({ score: { home: 2, away: 1 } }),
    source: 'fd',
    priority: 100,
    updatedAt: '2026-10-01T18:30:00Z',
  };
  const incoming = {
    ...fixture({ score: { home: 1, away: 0 } }),
    source: 'tsdb',
    priority: 40,
    updatedAt: '2026-10-01T18:20:00Z', // ten minutes older
  };

  const result = reconcileMatch(existing, incoming);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'stale_write');
  assert.deepEqual(result.value.score, { home: 2, away: 1 }, 'the newer score survives');
  assert.equal(result.conflicts[0].code, 'stale_write_blocked');
});

test('scenario: two providers disagree — newer wins, equal timestamps fall back to priority', () => {
  const base = { source: 'af', priority: 90, updatedAt: '2026-10-01T18:30:00Z' };

  const newerFromLowerPriority = reconcileMatch(
    { ...fixture({ score: { home: 1, away: 1 } }), ...base },
    { ...fixture({ score: { home: 2, away: 1 } }), source: 'tsdb', priority: 40, updatedAt: '2026-10-01T18:31:00Z' },
  );
  assert.equal(newerFromLowerPriority.accepted, true, 'a genuinely newer record may win regardless of priority');

  const tieFromLowerPriority = reconcileMatch(
    { ...fixture({ score: { home: 1, away: 1 } }), ...base },
    { ...fixture({ score: { home: 2, away: 1 } }), source: 'tsdb', priority: 40, updatedAt: '2026-10-01T18:30:00Z' },
  );
  assert.equal(tieFromLowerPriority.accepted, false, 'on a tie the higher-priority source keeps the value');
});

test('scenario: corrupt provider data is rejected and never replaces good data', () => {
  const existing = { ...fixture(), source: 'fd', priority: 100, updatedAt: '2026-10-01T18:30:00Z' };
  const corrupt = {
    ...fixture({ score: { home: -1, away: 0 } }),
    source: 'espn',
    priority: 60,
    updatedAt: '2026-10-01T18:31:00Z',
  };

  assert.equal(validateMatch(corrupt).some((i) => i.level === 'error'), true);
  const result = reconcileMatch(existing, corrupt);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'invalid');
  assert.deepEqual(result.value.score, { home: 1, away: 0 }, 'stored data is intact');
});

test('scenario: a status never rolls backwards without a trusted correction', () => {
  const finished = {
    ...fixture({ status: 'finished', score: { home: 3, away: 0 } }),
    source: 'fd',
    priority: 100,
    updatedAt: '2026-10-01T20:00:00Z',
  };
  const regression = {
    ...fixture({ status: 'live' }),
    source: 'af',
    priority: 90,
    updatedAt: '2026-10-01T20:05:00Z',
  };

  assert.equal(canTransition('finished', 'live'), false);
  const rejected = reconcileMatch(finished, regression);
  assert.equal(rejected.reason, 'illegal_transition');
  assert.equal(rejected.value.status, 'finished');

  // The one sanctioned path: an explicit human/provider correction.
  const corrected = reconcileMatch(
    finished,
    { ...fixture({ status: 'finished', score: { home: 2, away: 1 } }), source: 'fd', priority: 100, updatedAt: '2026-10-01T21:00:00Z' },
    { trustedCorrection: true },
  );
  assert.equal(corrected.accepted, true);
  assert.equal(corrected.reason, 'accepted');
});

test('scenario: a frozen live match is detected by the stuck-live monitor', () => {
  const now = Date.parse('2026-10-01T19:30:00Z');
  const frozen = { ...fixture({ utcDate: '2026-10-01T18:00:00Z' }), lastUpdated: '2026-10-01T18:40:00Z' };
  assert.equal(isStuckLive(frozen, now), true);
  const fresh = { ...frozen, lastUpdated: '2026-10-01T19:28:00Z' };
  assert.equal(isStuckLive(fresh, now), false);
});

test('scenario: a partial provider cannot blank fields it does not carry', () => {
  const winner = pickField([
    { value: null, source: 'espn' },
    { value: 'https://cdn.example/crest.png', source: 'tsdb' },
  ]);
  assert.equal(winner.value, 'https://cdn.example/crest.png');
  assert.equal(winner.source, 'tsdb');

  const keepsFilled = pickField([
    { value: 'Al Ahly', source: 'fd' },
    { value: '', source: 'af' },
  ]);
  assert.equal(keepsFilled.value, 'Al Ahly', 'an empty string never displaces a filled field');
});

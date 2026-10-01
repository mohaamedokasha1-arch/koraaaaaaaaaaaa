import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransition,
  validateMatch,
  isNewer,
  reconcileMatch,
  pickField,
  isStuckLive,
  mergeEvents,
} from '../src/lib/pure/validation.ts';

const BASE = {
  id: 'fd~1',
  status: 'live',
  utcDate: '2026-10-01T17:00:00Z',
  minute: 55,
  home: { id: 'fd~57', name: 'Al Ahly' },
  away: { id: 'fd~58', name: 'Zamalek' },
  score: { home: 1, away: 0 },
  lastUpdated: '2026-10-01T18:00:00Z',
  provider: 'fd',
  source: 'fd',
  priority: 100,
};

const NOW = Date.parse('2026-10-01T18:05:00Z');

test('match state machine never moves backwards', () => {
  assert.ok(canTransition('scheduled', 'live'));
  assert.ok(canTransition('live', 'halftime'));
  assert.ok(canTransition('halftime', 'live'));
  assert.ok(canTransition('live', 'finished'));
  assert.ok(!canTransition('finished', 'live'), 'a finished match cannot become live again');
  assert.ok(!canTransition('finished', 'scheduled'));
  assert.ok(!canTransition('cancelled', 'live'));
  assert.ok(canTransition('finished', 'finished'), 'score corrections are allowed in place');
});

test('validateMatch rejects impossible records', () => {
  assert.equal(validateMatch(BASE, NOW).filter((i) => i.level === 'error').length, 0);

  const badScore = validateMatch({ ...BASE, score: { home: 44, away: 0 } }, NOW);
  assert.ok(badScore.some((i) => i.code === 'score_range'));

  const finishedNoScore = validateMatch({ ...BASE, status: 'finished', score: { home: null, away: null } }, NOW);
  assert.ok(finishedNoScore.some((i) => i.code === 'finished_without_score'));

  const sameTeam = validateMatch({ ...BASE, away: { id: 'fd~57', name: 'Al Ahly' } }, NOW);
  assert.ok(sameTeam.some((i) => i.code === 'same_team'));

  const bogusDate = validateMatch({ ...BASE, utcDate: '2750-01-01T00:00:00Z' }, NOW);
  assert.ok(bogusDate.some((i) => i.code === 'kickoff_implausible'));

  const sillyMinute = validateMatch({ ...BASE, minute: 240 }, NOW);
  assert.ok(sillyMinute.some((i) => i.code === 'minute_range'));
});

test('isNewer compares freshness first and source priority as the tie-break', () => {
  const slow = { source: 'tsdb', priority: 40, updatedAt: '2026-10-01T18:00:00Z' };
  const fast = { source: 'fd', priority: 100, updatedAt: '2026-10-01T18:04:00Z' };
  assert.ok(isNewer(fast, slow));
  assert.ok(!isNewer(slow, fast), 'an older record is never newer');

  const sameTimeLowPriority = { source: 'tsdb', priority: 40, updatedAt: '2026-10-01T18:04:00Z' };
  assert.ok(isNewer(fast, sameTimeLowPriority));
  assert.ok(!isNewer(sameTimeLowPriority, fast));
});

test('a slow provider answering late can NOT overwrite fresher data', () => {
  const existing = { ...BASE, source: 'fd', priority: 100, updatedAt: '2026-10-01T18:04:00Z', score: { home: 2, away: 0 } };
  const lateAnswer = { ...BASE, source: 'tsdb', priority: 40, updatedAt: '2026-10-01T17:30:00Z', score: { home: 1, away: 0 } };

  const result = reconcileMatch(existing, lateAnswer);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'stale_write');
  assert.deepEqual(result.value.score, { home: 2, away: 0 }, 'the fresher score is kept');
  assert.equal(result.conflicts[0].code, 'stale_write_blocked');
});

test('an illegal transition is rejected but a trusted correction is applied', () => {
  const finished = { ...BASE, status: 'finished', updatedAt: '2026-10-01T17:59:00Z' };
  const becomesLiveAgain = { ...BASE, status: 'live', updatedAt: '2026-10-01T18:04:00Z', source: 'tsdb', priority: 40 };

  const rejected = reconcileMatch(finished, becomesLiveAgain);
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason, 'illegal_transition');
  assert.equal(rejected.value.status, 'finished');

  const corrected = reconcileMatch(finished, becomesLiveAgain, { trustedCorrection: true });
  assert.equal(corrected.accepted, true);
  assert.equal(corrected.reason, 'accepted_correction');
});

test('an invalid incoming record never replaces a good stored one', () => {
  const existing = { ...BASE, score: { home: 2, away: 1 } };
  const broken = { ...BASE, lastUpdated: '2026-10-01T18:04:30Z', score: { home: 44, away: -3 } };
  const result = reconcileMatch(existing, broken);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'invalid');
  assert.deepEqual(result.value.score, { home: 2, away: 1 });
});

test('a first record is always accepted when it is sane', () => {
  const result = reconcileMatch(null, { ...BASE, source: 'tsdb', priority: 40 });
  assert.equal(result.accepted, true);
  assert.equal(result.reason, 'accepted');
});

test('field-level priority: the best provider wins each field and empty never displaces filled', () => {
  const winner = pickField([
    { value: null, source: 'fd', priority: 100, updatedAt: '2026-10-01T18:00:00Z' },
    { value: 'https://crests.example/ahly.png', source: 'tsdb', priority: 40, updatedAt: '2026-10-01T17:00:00Z' },
  ]);
  assert.equal(winner.source, 'tsdb', 'a lower-priority source still supplies the only real value');
  assert.equal(winner.value, 'https://crests.example/ahly.png');

  const higher = pickField([
    { value: 'A', source: 'fd', priority: 100, updatedAt: '2026-10-01T18:00:00Z' },
    { value: 'B', source: 'tsdb', priority: 40, updatedAt: '2026-10-01T18:30:00Z' },
  ]);
  assert.equal(higher.value, 'A', 'priority decides when both have a value');
});

test('stuck live matches are detectable and events merge without duplicating', () => {
  assert.ok(isStuckLive({ ...BASE, lastUpdated: '2026-10-01T17:00:00Z' }, NOW));
  assert.ok(!isStuckLive({ ...BASE, lastUpdated: '2026-10-01T18:04:00Z' }, NOW));
  assert.ok(!isStuckLive({ ...BASE, status: 'finished', lastUpdated: '2020-01-01T00:00:00Z' }, NOW));

  const merged = mergeEvents(
    [{ type: 'goal', minute: 12, player: 'Salah' }],
    [
      { type: 'goal', minute: 12, player: 'Salah' },
      { type: 'yellow', minute: 30, player: 'Zizo' },
    ],
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[1].type, 'yellow');
});

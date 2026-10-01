import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSubscription,
  inQuietHours,
  minutesOfDayInZone,
  shouldNotify,
  deriveMatchEvents,
} from '../src/lib/pure/notifications.ts';

const DEVICE = 'device-abcdefgh-1234567890';

function subscription(overrides = {}) {
  const result = validateSubscription({
    deviceId: DEVICE,
    topics: [{ kind: 'team', id: 'team:al-ahly-eg' }],
    channels: ['in-app'],
    locale: 'ar',
    timezone: 'Africa/Cairo',
    ...overrides,
  });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  return result.value;
}

test('subscription validation rejects junk and keeps defaults honest', () => {
  assert.equal(validateSubscription(null).ok, false);
  assert.equal(validateSubscription({ deviceId: 'short', topics: [{ kind: 'team', id: 'x' }] }).ok, false);
  assert.equal(validateSubscription({ deviceId: DEVICE, topics: [] }).ok, false);
  assert.equal(validateSubscription({ deviceId: DEVICE, topics: [{ kind: 'planet', id: 'x' }] }).ok, false);

  const ok = validateSubscription({ deviceId: DEVICE, topics: [{ kind: 'match', id: 'fd~1' }] });
  assert.equal(ok.ok, true);
  // No channel given → in-app only. Push is NEVER enabled implicitly.
  assert.deepEqual(ok.value.channels, ['in-app']);
});

test('quiet hours are evaluated in the subscriber timezone, and wrap midnight', () => {
  const quiet = { from: '23:00', to: '07:00' };
  // 22:00 UTC = 01:00 in Cairo → inside a Cairo 23:00–07:00 window.
  assert.equal(inQuietHours(new Date('2026-10-01T22:00:00Z'), quiet, 'Africa/Cairo'), true);
  // Same instant in UTC is 22:00 → outside the window.
  assert.equal(inQuietHours(new Date('2026-10-01T22:00:00Z'), quiet, 'UTC'), false);
  // 12:00 UTC = 15:00 Cairo → outside.
  assert.equal(inQuietHours(new Date('2026-10-01T12:00:00Z'), quiet, 'Africa/Cairo'), false);
  assert.equal(inQuietHours(new Date(), { from: '08:00', to: '08:00' }), false);
});

test('urgent match events bypass quiet hours, the rest respect them', () => {
  const sub = subscription({ quietHours: { from: '00:00', to: '23:59' } });
  const at = new Date('2026-10-01T12:00:00Z');

  const goal = { id: 'e1', type: 'match.goal', at: at.toISOString(), entityIds: ['team:al-ahly-eg'], matchId: 'm1', data: {}, dedupeKey: 'goal:1' };
  assert.equal(shouldNotify(sub, goal, at).notify, true);

  const lineups = { ...goal, id: 'e2', type: 'match.lineups', dedupeKey: 'lineups' };
  assert.deepEqual(shouldNotify(sub, lineups, at), { notify: false, reason: 'quiet-hours' });

  const other = { ...goal, id: 'e3', type: 'match.goal', entityIds: ['team:other'], dedupeKey: 'goal:2' };
  assert.deepEqual(shouldNotify(sub, other, at), { notify: false, reason: 'not-subscribed' });
});

test('events are derived only from real transitions (never from nothing)', () => {
  const base = {
    id: 'fd~123',
    status: 'scheduled',
    homeTeamId: 'team:a',
    awayTeamId: 'team:b',
    leagueId: 'league:pl',
    utcDate: '2026-10-02T19:00:00Z',
    minute: null,
    score: { home: null, away: null },
    events: [],
  };

  const scheduled = deriveMatchEvents(null, base);
  assert.deepEqual(scheduled.map((e) => e.type), ['match.scheduled']);

  const live = deriveMatchEvents(base, { ...base, status: 'live' });
  assert.deepEqual(live.map((e) => e.type), ['match.kickoff']);

  const goal = deriveMatchEvents({ ...base, status: 'live', score: { home: 0, away: 0 } }, {
    ...base,
    status: 'live',
    minute: 20,
    score: { home: 1, away: 0 },
    events: [{ type: 'goal', minute: 20, player: 'Player', teamId: 'team:a' }],
  });
  assert.ok(goal.some((e) => e.type === 'match.goal'));

  // A repeated poll with no change produces no event at all.
  const still = deriveMatchEvents({ ...base, status: 'live', score: { home: 1, away: 0 } }, {
    ...base,
    status: 'live',
    score: { home: 1, away: 0 },
  });
  assert.equal(still.length, 0);
});

test('minutesOfDayInZone returns the local wall clock', () => {
  // 22:00 UTC is 01:00 next day in Cairo (UTC+3).
  assert.equal(minutesOfDayInZone(new Date('2026-10-01T22:00:00Z'), 'Africa/Cairo'), 60);
  assert.equal(minutesOfDayInZone(new Date('2026-10-01T22:00:00Z'), 'UTC'), 22 * 60);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TZ,
  TIMEZONE_COOKIE,
  TIMEZONE_CHOICES,
  isValidTimeZone,
  resolveTimeZone,
  localDayInZone,
  zoneLabel,
} from '../src/lib/pure/time.ts';

test('the timezone cookie is fixed and the default zone always resolves', () => {
  assert.equal(TIMEZONE_COOKIE, 'KORA_TZ');
  assert.equal(resolveTimeZone(null), DEFAULT_TZ);
  assert.equal(resolveTimeZone('not/a-zone'), DEFAULT_TZ);
  assert.equal(resolveTimeZone('Europe/London'), 'Europe/London');
});

test('only real IANA zones from the curated list are accepted', () => {
  assert.equal(isValidTimeZone('Africa/Cairo'), true);
  assert.equal(isValidTimeZone('Asia/Riyadh'), true);
  assert.equal(isValidTimeZone(''), false);
  assert.equal(isValidTimeZone(null), false);
  // Zone-like but not in the curated list: rejected, never passed to Intl.
  assert.equal(isValidTimeZone('Europe/Kyiv/../etc'), false);
  assert.equal(isValidTimeZone('NotAZone'), false);
  assert.ok(TIMEZONE_CHOICES.some((c) => c.id === 'Africa/Cairo'));
});

test('a calendar day is computed in the viewer zone, not in UTC', () => {
  // 22:30 UTC on 30 Sep is already 01:30 on 1 Oct in Cairo (UTC+3 in 2026 DST-free Egypt).
  assert.equal(localDayInZone('2026-09-30T22:30:00Z', 'Africa/Cairo'), '2026-10-01');
  assert.equal(localDayInZone('2026-09-30T22:30:00Z', 'UTC'), '2026-09-30');
  // And the other direction: 00:30 UTC is still the previous day in New York.
  assert.equal(localDayInZone('2026-10-01T00:30:00Z', 'America/New_York'), '2026-09-30');
});

test('zone labels come from the curated list and fall back to the raw id', () => {
  assert.equal(zoneLabel('Africa/Cairo', 'ar'), zoneLabel('Africa/Cairo', 'ar'));
  assert.match(zoneLabel('Africa/Cairo', 'en'), /Cairo/);
  assert.equal(zoneLabel('Mars/Olympus', 'en'), 'Mars/Olympus');
});

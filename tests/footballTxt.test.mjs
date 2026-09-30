import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFootballTxt, zonedToUtc } from '../src/lib/pure/footballTxt.ts';

const SAMPLE = `= Egypt | Premiership 2024/25

# Date       Wed Oct 30 2024 - Fri May 30 2025 (212d)

▪ Matchday 1
  Wed Oct 30 2024
    17:00  Haras El Hodood         v Smouha Sporting Club     1-3 (1-2)
    20:00  Tala'ea El Gaish SC     v Al Masry Club            0-2 (0-0)
  Thu Oct 31
    17:00  El Gouna                v ZED FC                   0-0
    20:00  Future FC               v ENPPI                    0-0

▪ Matchday 2
  Wed Jan 15
    19:00  Pyramids FC             v Ghazl Al Mehalla         3-0 (1-0)
`;

test('parses matchdays, dates and full/half-time scores', () => {
  const lines = parseFootballTxt(SAMPLE, '2024-25');
  assert.equal(lines.length, 5);
  assert.equal(lines[0].matchday, 1);
  assert.equal(lines[0].home, 'Haras El Hodood');
  assert.equal(lines[0].away, 'Smouha Sporting Club');
  assert.deepEqual(lines[0].ft, [1, 3]);
  assert.deepEqual(lines[0].ht, [1, 2]);
  assert.deepEqual(lines[2].ht, null, 'a score without a half-time part must stay null, not be invented');
});

test('infers the year of date headers that omit it (season rollover)', () => {
  const lines = parseFootballTxt(SAMPLE, '2024-25');
  // "Wed Oct 30 2024" is explicit
  assert.equal(lines[0].date.toISOString().slice(0, 10), '2024-10-30');
  // "Wed Jan 15" belongs to the second half of the 2024/25 season → 2025
  assert.equal(lines[4].date.toISOString().slice(0, 10), '2025-01-15');
  assert.equal(lines[4].matchday, 2);
});

test('zonedToUtc respects Egyptian DST (EET +2 in winter, EEST +3 in summer)', () => {
  const winter = zonedToUtc(new Date(Date.UTC(2025, 0, 15)), '19:00', 'Africa/Cairo');
  const summer = zonedToUtc(new Date(Date.UTC(2025, 6, 15)), '19:00', 'Africa/Cairo');
  assert.equal(winter, '2025-01-15T17:00:00.000Z');
  assert.equal(summer, '2025-07-15T16:00:00.000Z');
});

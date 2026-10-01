import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seasonLabelFor,
  seasonRange,
  seasonRef,
  seasonForDate,
  isInSeason,
  sortSeasonLabels,
  seasonKindFor,
  seasonDisplayLabel,
  crossYearLabel,
  isSeasonLabel,
} from '../src/lib/pure/season.ts';

test('cross-year seasons roll over in July, so a season never mixes years', () => {
  assert.equal(seasonLabelFor('2026-10-01T19:00:00Z', 'cross-year'), '2026-27');
  assert.equal(seasonLabelFor('2026-06-30T19:00:00Z', 'cross-year'), '2025-26');
  assert.equal(seasonLabelFor('2026-08-15T19:00:00Z', 'cross-year'), '2026-27');
  assert.equal(crossYearLabel(2025), '2025-26');
});

test('calendar seasons map a whole year to one label', () => {
  assert.equal(seasonLabelFor('2026-10-01', 'calendar'), '2026');
  assert.equal(seasonLabelFor('2026-01-05', 'calendar'), '2026');
  assert.equal(seasonRange('2026', 'calendar').startDate, '2026-01-01');
  assert.equal(seasonRange('2026', 'calendar').endDate, '2026-12-31');
});

test('seasonRange for a cross-year label covers the full campaign', () => {
  const range = seasonRange('2024-25', 'cross-year');
  assert.equal(range.startDate, '2024-07-01');
  assert.equal(range.endDate, '2025-07-01');
  assert.ok(isSeasonLabel('2024-25', 'cross-year'));
  assert.ok(isSeasonLabel('2026', 'calendar'));
  assert.ok(!isSeasonLabel('2024-25', 'calendar'));
});

test('season refs carry a league-scoped stable id and contain their matches', () => {
  const ref = seasonRef('EGY', '2024-25', 'cross-year');
  assert.ok(ref);
  assert.equal(ref.id, 'EGY:2024-25');
  assert.ok(isInSeason('2025-03-10', ref));
  assert.ok(!isInSeason('2025-08-10', ref));

  const viaDate = seasonForDate('PL', '2025-03-10T15:00:00Z', seasonKindFor('PL'));
  assert.equal(viaDate?.label, '2024-25');
  assert.equal(viaDate?.id, 'PL:2024-25');
});

test('Brasileirão is treated as a calendar season, Europe as cross-year', () => {
  assert.equal(seasonKindFor('BSA'), 'calendar');
  assert.equal(seasonKindFor('PL'), 'cross-year');
  assert.equal(seasonKindFor('EGY'), 'cross-year');
});

test('season labels sort newest-first and display with a slash', () => {
  assert.deepEqual(sortSeasonLabels(['2023-24', '2025-26', '2024-25']), ['2025-26', '2024-25', '2023-24']);
  assert.deepEqual(sortSeasonLabels(['2024', '2026', '2025'], 'asc'), ['2024', '2025', '2026']);
  assert.equal(seasonDisplayLabel('2024-25'), '2024/25');
  assert.equal(seasonDisplayLabel('2026'), '2026');
});

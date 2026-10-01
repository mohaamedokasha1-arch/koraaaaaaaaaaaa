import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStory, eventMinute, eventSegment, filterStory, adjacentSegment, storyText, isHighlight, MAX_STORY_EVENTS } from '../src/features/match-story/lib/model.ts';
import { storyCopy } from '../src/features/match-story/lib/copy.ts';

// Validation cases only: synthetic events are never imported by production data.
const event = (overrides = {}) => ({ type: 'goal', minute: 12, extraMinute: null, teamId: 'fd~1', player: 'Test scorer', assist: null, playerIn: null, playerOut: null, ...overrides });
const match = (events = []) => ({ events, home: { id: 'fd~1' }, away: { id: 'fd~2' } });

test('an empty/unavailable feed remains empty, never a fabricated kickoff or highlight', () => {
  assert.deepEqual(buildStory(match()), { events: [], omitted: 0, highlights: [] });
  assert.equal(buildStory(match(null)).events.length, 0);
});
test('only exact known team identifiers are attributed; unknown is not the away team', () => {
  const story = buildStory(match([event(), event({ teamId: 'fd~2' }), event({ teamId: null }), event({ teamId: 'af~2' })]));
  assert.deepEqual(story.events.map(e => e.side), ['home', 'away', 'unknown', 'unknown']);
});
test('stoppage stays with its base-minute filter; later/unknown are not assigned a period', () => {
  assert.equal(eventSegment(45), 'first'); assert.equal(eventSegment(46), 'second');
  assert.equal(eventSegment(90), 'second'); assert.equal(eventSegment(91), 'later'); assert.equal(eventSegment(null), 'unknown');
  const story = buildStory(match([event({ minute: 45, extraMinute: 7 }), event({ minute: 90, extraMinute: 3 }), event({ minute: 103 }), event({ minute: null })]));
  assert.equal(filterStory(story.events, 'first')[0].extraMinute, 7);
  assert.equal(filterStory(story.events, 'second')[0].minute, 90);
  assert.equal(filterStory(story.events, 'later')[0].minute, 103);
  assert.equal(filterStory(story.events, 'unknown')[0].minute, null);
  assert.equal(filterStory(story.events, 'all'), story.events);
});
test('source order is normalized without mutating the input or interleaving stoppage into the next half', () => {
  const input = [event({ minute: null }), event({ minute: 46 }), event({ minute: 45, extraMinute: 3 }), event({ minute: 2 }), event({ minute: 45, extraMinute: 1 })];
  const before = structuredClone(input);
  const story = buildStory(match(input));
  assert.deepEqual(story.events.map(e => [e.minute, e.extraMinute]), [[2, null], [45, 1], [45, 3], [46, null], [null, null]]);
  assert.deepEqual(input, before);
});
test('missing/invalid minutes are unknown; zero and real stoppage are kept', () => {
  assert.equal(eventMinute(event({ minute: 0 })), '0′');
  assert.equal(eventMinute(event({ minute: 90, extraMinute: 4 })), '90+4′');
  assert.equal(eventMinute(event({ minute: null, extraMinute: 2 })), null);
  assert.equal(eventMinute(event({ minute: NaN })), null);
  assert.equal(buildStory(match([event({ minute: -1, extraMinute: 2 })])).events[0].segment, 'unknown');
});
test('goals and actual dismissals are highlights, not yellow cards or invented ratings', () => {
  for (const type of ['goal', 'own_goal', 'penalty_goal', 'red', 'yellow_red']) assert.equal(isHighlight(event({ type })), true);
  for (const type of ['yellow', 'sub']) assert.equal(isHighlight(event({ type })), false);
  const story = buildStory(match([event(), event({ type: 'yellow' }), event({ type: 'red' })]));
  assert.equal(story.highlights.length, 2);
  assert.equal('score' in story, false); assert.equal('rating' in story, false);
});
test('all actual source event types survive, including own goals and second-yellow dismissals', () => {
  const types = ['goal', 'own_goal', 'penalty_goal', 'yellow', 'red', 'yellow_red', 'sub'];
  assert.deepEqual(buildStory(match(types.map(type => event({ type })))).events.map(e => e.type), types);
});
test('malformed/oversized feeds are bounded and omission is reported, not silently presented as complete', () => {
  const list = [null, 'bad', event({ type: 'invented' }), ...Array.from({ length: MAX_STORY_EVENTS + 20 }, () => event())];
  const story = buildStory(match(list));
  assert.equal(story.events.length, MAX_STORY_EVENTS - 3);
  assert.equal(story.omitted, 26);
  assert.equal(new Set(story.events.map(e => e.key)).size, story.events.length);
});
test('presentation keys stay stable on a new source snapshot and do not replace provider IDs', () => {
  const old = buildStory(match([event()])).events[0];
  const fresh = buildStory(match([event({ minute: 1 }), event()])).events[1];
  assert.equal(old.key, fresh.key); assert.equal(old.teamId, 'fd~1');
});
test('bounded text strips control/bidi overrides, not Arabic names or literal markup text', () => {
  assert.equal(storyText('  الأهلي\u202e  '), 'الأهلي');
  assert.equal(storyText('<script>alert(1)</script>'), '<script>alert(1)</script>'); // React escapes at render.
  assert.equal(storyText('😀'.repeat(200)).length, 320);
  assert.equal(storyText({ password: 'never copied' }), null);
});
test('horizontal navigation is bounded with endpoints, and both languages have complete event labels', () => {
  assert.equal(adjacentSegment('all', -1), 'all'); assert.equal(adjacentSegment('unknown', 1), 'unknown');
  assert.equal(adjacentSegment('first', 1), 'second');
  const ar = storyCopy('ar'), en = storyCopy('en');
  assert.deepEqual(Object.keys(ar.labels), Object.keys(en.labels)); assert.deepEqual(Object.keys(ar.segments), Object.keys(en.segments));
});

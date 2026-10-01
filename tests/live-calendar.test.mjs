import test from 'node:test';
import assert from 'node:assert/strict';
import { matchCalendar } from '../src/features/live/lib/calendar.ts';
import { twitchEmbedUrl, youtubeEmbedUrl } from '../src/features/live/adapters/urls.ts';

const match = { matchId: 'fd~42', home: { name: 'Home\nInjected' }, away: { name: 'Away, Inc.' }, competition: { name: 'League; Cup' }, startsAt: '2026-10-01T18:00:00Z', endsAt: null };
test('calendar uses UTC, reserves two hours, includes reminder and escapes user text', () => {
  const calendar = matchCalendar(match, 'https://example.com/ar/watch/fd~42', '2026-10-01T12:00:00Z');
  assert.ok(calendar.includes('DTSTART:20261001T180000Z\r\nDTEND:20261001T200000Z'));
  assert.ok(calendar.includes('Home\\nInjected vs Away\\, Inc.'));
  assert.ok(calendar.includes('TRIGGER:-PT15M'));
  assert.equal((calendar.match(/BEGIN:VEVENT/g) ?? []).length, 1);
});
test('embeds use privacy-enhanced YouTube and the actual preview parent for Twitch', () => {
  const youtube = new URL(youtubeEmbedUrl('abcdefghijk', 'https://3000-preview.e2b.app'));
  assert.equal(youtube.hostname, 'www.youtube-nocookie.com');
  assert.equal(youtube.searchParams.get('origin'), 'https://3000-preview.e2b.app');
  const twitch = new URL(twitchEmbedUrl('official_test', '3000-preview.e2b.app'));
  assert.equal(twitch.searchParams.get('parent'), '3000-preview.e2b.app');
  assert.throws(() => youtubeEmbedUrl('<script>', 'https://example.com'));
  assert.throws(() => twitchEmbedUrl('official_test', 'evil.example/?x=1'));
});
test('calendar folds long UTF-8 Arabic lines to RFC 5545 octet limits', () => {
  const calendar = matchCalendar({ ...match, home: { name: 'الأهلي'.repeat(40) } }, 'https://example.com/match', '2026-10-01T12:00:00Z');
  for (const line of calendar.split('\r\n')) assert.ok(new TextEncoder().encode(line).byteLength <= 75);
  assert.ok(calendar.replace(/\r\n /g, '').includes('الأهلي'.repeat(40)));
});
test('failed embeds can link out to the reviewed official provider, never to an HLS manifest', async () => {
  const { officialSourceUrl } = await import('../src/features/live/adapters/urls.ts');
  assert.equal(officialSourceUrl({ provider: 'youtube', sourceRef: 'abcdefghijk' }), 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(officialSourceUrl({ provider: 'twitch', sourceRef: 'official_test' }), 'https://www.twitch.tv/official_test');
  assert.equal(officialSourceUrl({ provider: 'hls', sourceRef: 'https://licensed.example/file.m3u8' }), null);
  assert.equal(officialSourceUrl({ provider: 'external', sourceRef: 'javascript:alert(1)' }), null);
});

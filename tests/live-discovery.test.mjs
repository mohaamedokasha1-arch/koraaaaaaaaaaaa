import test from 'node:test';
import assert from 'node:assert/strict';
import { applyYouTubeMetadata, channelForSlot, mergeDiscoveries, scorebatEmbedFromApi, youtubeCandidate, YOUTUBE_DAILY_SCHEDULED_SEARCHES, YOUTUBE_SEARCH_COST } from '../src/features/live/lib/discovery.ts';

const channel = { id: 'UCabcdefghijklmnopqrstuv', name: 'Test official channel', enabled: true };
const now = '2026-10-01T19:00:00Z';
const video = { id: 'abcdefghijk', snippet: { channelId: channel.id, title: 'Test stream', liveBroadcastContent: 'live' }, status: { embeddable: true, privacyStatus: 'public' }, liveStreamingDetails: { actualStartTime: '2026-10-01T18:00:00Z' } };
const stream = { id: 'one', matchId: 'fd~42', provider: 'youtube', sourceRef: video.id, channelId: channel.id, startsAt: '2026-10-01T18:00:00Z', endsAt: null, status: 'scheduled' };

test('96 one-channel searches plus metadata stay below the default 10k daily quota', () => {
  assert.ok(YOUTUBE_DAILY_SCHEDULED_SEARCHES * (YOUTUBE_SEARCH_COST + 1) < 10_000);
  const channels = [channel, { ...channel, id: 'another' }, { ...channel, id: 'disabled', enabled: false }];
  const first = channelForSlot(channels, Date.parse(now));
  const next = channelForSlot(channels, Date.parse(now) + 15 * 60 * 1000);
  assert.notEqual(first.id, next.id); assert.notEqual(next.id, 'disabled');
  assert.equal(channelForSlot([], Date.parse(now)), null);
});
test('discovery rejects mismatched channels; never invents match associations', () => {
  assert.equal(youtubeCandidate({ ...video, snippet: { ...video.snippet, channelId: 'wrong' } }, channel, now), null);
  const candidate = youtubeCandidate(video, channel, now);
  assert.equal(candidate.provider, 'youtube'); assert.equal('matchId' in candidate, false);
  const catalog = { streams: [], matches: [] };
  assert.deepEqual(applyYouTubeMetadata(catalog, [video], [video.id], [channel], now), catalog);
});
test('metadata updates only pre-linked IDs and fails closed on unembeddable/private/unknown videos', () => {
  const catalog = { streams: [stream, { ...stream, id: 'two', sourceRef: 'other_video' }], updatedAt: null };
  const result = applyYouTubeMetadata(catalog, [video], [video.id], [channel], now);
  assert.equal(result.streams[0].status, 'live'); assert.deepEqual(result.streams[1], catalog.streams[1]);
  for (const videos of [[], [{ ...video, status: { ...video.status, embeddable: false } }], [{ ...video, status: { ...video.status, privacyStatus: 'private' } }]]) {
    assert.equal(applyYouTubeMetadata(catalog, videos, [video.id], [channel], now).streams[0].status, 'failed');
  }
});
test('Scorebat extraction publishes only a safe URL, without HTML/scripts or API token query strings', () => {
  assert.equal(scorebatEmbedFromApi('<iframe src="https://www.scorebat.com/embed/g/abc123/?token=SECRET&amp;utm_source=test"></iframe><script>alert(1)</script>'), 'https://www.scorebat.com/embed/g/abc123/');
  assert.equal(scorebatEmbedFromApi('<iframe src="https://evil.example/embed/g/abc123/"></iframe>'), null);
  assert.equal(scorebatEmbedFromApi('<iframe src="javascript:alert(1)"></iframe>'), null);
});
test('candidate merging deduplicates, expires seven-day-old entries and caps output', () => {
  const candidate = youtubeCandidate(video, channel, now);
  const old = { ...candidate, sourceRef: 'old_video_1', discoveredAt: '2026-09-01T00:00:00Z' };
  assert.equal(mergeDiscoveries([old, candidate], [candidate], Date.parse(now)).length, 1);
  const many = Array.from({ length: 400 }, (_, index) => ({ ...candidate, sourceRef: String(index) }));
  assert.equal(mergeDiscoveries([], many, Date.parse(now)).length, 300);
});

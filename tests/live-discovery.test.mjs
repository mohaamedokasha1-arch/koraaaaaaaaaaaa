import test from 'node:test';
import assert from 'node:assert/strict';
import { applyYouTubeMetadata, channelForSlot, mergeDiscoveries, scorebatEmbedFromApi, youtubeCandidate, YOUTUBE_DAILY_SCHEDULED_SEARCHES, YOUTUBE_SEARCH_COST, youtubeMetadataBatch, YOUTUBE_METADATA_BATCH_SIZE, YOUTUBE_SEARCH_RESULTS } from '../src/features/live/lib/discovery.ts';

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

test('metadata batching reserves room for fresh live discoveries, deduplicates and stays within one API request', () => {
  const linked = Array.from({ length: 125 }, (_, index) => `video${String(index).padStart(6, '0')}`);
  const live = Array.from({ length: 10 }, (_, index) => `newid${String(index).padStart(6, '0')}`);
  const batch = youtubeMetadataBatch([...linked, linked[0]], [...live, live[0]], 4, Date.parse(now));
  assert.equal(batch.length, YOUTUBE_METADATA_BATCH_SIZE);
  assert.equal(new Set(batch).size, batch.length);
  assert.deepEqual(batch.slice(0, live.length), live);
  assert.equal(batch.filter((id) => linked.includes(id)).length, 40);
  assert.deepEqual(youtubeMetadataBatch([linked[0], linked[0], live[0]], [live[0]], 1, Date.parse(now)), [live[0], linked[0]]);
  assert.deepEqual(youtubeMetadataBatch([], [], 0, Date.parse(now)), []);
});

test('every linked video is eventually checked, including channel counts that divide 96 slots', () => {
  const linked = Array.from({ length: 125 }, (_, index) => `video${String(index).padStart(6, '0')}`);
  const live = Array.from({ length: YOUTUBE_SEARCH_RESULTS }, (_, index) => `newid${String(index).padStart(6, '0')}`);
  const visits = Math.ceil(linked.length / (YOUTUBE_METADATA_BATCH_SIZE - live.length));
  for (const channelCount of [1, 2, 4, 12, 96]) {
    const checked = new Set();
    for (let visit = 0; visit < visits; visit++) {
      const at = Date.parse(now) + visit * channelCount * 15 * 60 * 1000;
      const batch = youtubeMetadataBatch(linked, live, channelCount, at);
      assert.equal(batch.length, 50);
      for (const id of batch) checked.add(id);
      assert.deepEqual(batch, youtubeMetadataBatch(linked, live, channelCount, at), 'same slot is deterministic');
    }
    for (const id of linked) assert.equal(checked.has(id), true, `${channelCount} channels: ${id}`);
  }
});

test('discovery ordering compares instants rather than ISO strings with different offsets', () => {
  const candidate = youtubeCandidate(video, channel, now);
  const earlier = { ...candidate, sourceRef: 'earlyVideo1', discoveredAt: '2026-10-01T20:00:00+03:00' };
  const later = { ...candidate, sourceRef: 'laterVideo1', discoveredAt: '2026-10-01T18:00:00Z' };
  assert.deepEqual(mergeDiscoveries([earlier, later], [], Date.parse(now)).map((item) => item.sourceRef), ['laterVideo1', 'earlyVideo1']);
});

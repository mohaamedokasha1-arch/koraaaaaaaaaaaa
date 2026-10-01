import { emptyCatalog, streamSchema, type LiveCatalog, type LiveMatch } from '../../../src/features/live/types/index.ts';

// Explicitly fictional testing fixtures. Never written into public/live or a DB.
export const testMatch: LiveMatch = {
  matchId: 'test~fixture',
  home: { id: 'test~home', name: 'Test home', crest: null },
  away: { id: 'test~away', name: 'Test away', crest: null },
  competition: { id: 'TEST', name: 'Synthetic test fixture', code: null },
  startsAt: '2026-10-01T18:00:00Z', endsAt: null, status: 'live',
};
function source(id: string, sourceRef: string, priority: number) {
  return streamSchema.parse({
    id, matchId: testMatch.matchId, label: id === 'first' ? 'Test source one' : 'Test source two',
    provider: 'youtube', sourceRef, channelId: 'UCabcdefghijklmnopqrstuv', priority,
    language: 'en', quality: 'HD', region: [], isOfficial: true,
    rights: { basis: 'official', referenceUrl: 'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv', verifiedAt: '2026-10-01T00:00:00Z', verifiedBy: 'Synthetic test only' },
    status: 'live', startsAt: testMatch.startsAt, endsAt: null, reportCount: 0,
  });
}
export function makeFixture(mode = 'youtube'): LiveCatalog {
  const first = source('first', 'testVideo01', 1);
  const second = source('second', 'testVideo02', 2);
  const catalog = { ...emptyCatalog(), matches: [{ ...testMatch }], streams: [first, second] };
  if (mode === 'iframe') catalog.streams[0] = { ...first, provider: 'iframe', sourceRef: 'https://www.scorebat.com/embed/g/test/', label: 'Test iframe' };
  // The mock hls.js performs NO network request and injects two fatal errors.
  // This host is deliberately NOT publishable under the default live policy.
  if (mode === 'hls') catalog.streams[0] = { ...first, provider: 'hls', sourceRef: 'https://test.invalid/test.m3u8' };
  if (mode === 'temporary') catalog.streams = catalog.streams.map((stream) => ({ ...stream, hiddenUntil: '2026-10-01T19:01:00Z' }));
  if (mode === 'expiring') catalog.streams = catalog.streams.map((stream) => ({ ...stream, endsAt: '2026-10-01T19:01:00Z' }));
  if (mode === 'empty' || mode === 'scheduled') catalog.streams = [];
  if (mode === 'external') catalog.streams = [{ ...first, provider: 'external', sourceRef: 'https://www.beinsports.com/', label: 'Reviewed test broadcaster' }];
  if (mode === 'scheduled') catalog.matches[0] = { ...testMatch, status: 'scheduled', startsAt: '2099-01-01T18:00:00Z' };
  return catalog;
}

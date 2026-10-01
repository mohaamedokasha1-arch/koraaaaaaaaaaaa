import type { DataResult, UnifiedMatch } from '../../../../../src/lib/types';

// Synthetic test snapshots live only in the separate browser fixture application.
export function cardSnapshot(scenario: string, fresh = false): DataResult<UnifiedMatch> {
  const ar = scenario.startsWith('ar');
  return { source: 'fd', stale: scenario.includes('stale'), fetchedAt: fresh ? '2026-10-02T18:46:00Z' : '2026-10-02T18:45:00Z', data: {
    id: 'fd~990001', provider: 'fd', providerId: '990001', utcDate: '2026-10-02T19:00:00Z',
    status: scenario.includes('finished') ? 'finished' : scenario.includes('fixture') ? 'scheduled' : scenario.includes('cancelled') ? 'cancelled' : 'live', minute: fresh ? 71 : 70,
    home: { id: 'fd~1', name: scenario.includes('nonlatin') ? '東京 FC' : ar ? 'الأهلي' : 'Isolated home', shortName: null, crest: 'https://unlicensed.test/never-export.png' },
    away: { id: 'fd~2', name: ar ? 'الزمالك' : 'Isolated away', shortName: null, crest: null },
    score: { home: fresh ? 5 : 4, away: 2, htHome: 1, htAway: 0 },
    league: { id: 'fd~PL', code: 'PL', name: ar ? 'بطولة الاختبار المعزول' : 'Isolated test competition', country: null, emblem: null },
    events: [], lastUpdated: '2026-10-02T18:45:00Z', matchday: null, venue: null, referee: null,
  } };
}

'use client';

import { useState } from 'react';
import type { MatchEvent, UnifiedMatch } from '../../../../../../../src/lib/types';
import { MatchStory } from '../../../../../../../src/features/match-story/components/MatchStory';

// SEPARATE browser-test app. Synthetic football data never appears in production.
const ev = (value: Partial<MatchEvent>): MatchEvent => ({ type: 'goal', minute: 12, extraMinute: null, teamId: 'fd~1', player: 'Isolated scorer', assist: null, playerIn: null, playerOut: null, ...value });
const base: UnifiedMatch = {
  id: 'fd~990001', provider: 'fd', providerId: '990001', utcDate: '2026-10-02T19:00:00Z', status: 'live', minute: 70,
  home: { id: 'fd~1', name: 'الأهلي — Isolated home', shortName: null, crest: null }, away: { id: 'fd~2', name: 'الزمالك — Isolated away', shortName: null, crest: null },
  score: { home: 4, away: 2 }, league: { id: 'fd~PL', code: 'PL', name: 'Isolated test league', emblem: null, country: null },
  matchday: null, venue: null, referee: null, lastUpdated: '2026-10-02T19:00:00Z', events: [
    ev({ assist: 'Isolated assist' }), ev({ minute: 45, extraMinute: 3, type: 'yellow', player: 'First stoppage player' }),
    ev({ minute: 61, teamId: 'fd~2', type: 'sub', player: null, playerIn: 'Incoming test player', playerOut: 'Outgoing test player' }),
    ev({ minute: 90, extraMinute: 4, type: 'red', teamId: 'af~2', player: 'Unknown-team test player' }),
    ev({ minute: 102, type: 'penalty_goal', teamId: 'fd~2' }), ev({ minute: null, player: '<script>literal source name</script>', teamId: null }),
  ],
};
export default function StoryFixture({ scenario }: { scenario: string }) {
  const [fresh, setFresh] = useState(false);
  const locale = scenario.startsWith('ar') ? 'ar' : 'en';
  const empty = scenario.includes('empty') || scenario.includes('upcoming');
  const many = scenario.includes('many');
  const match = { ...base,
    status: scenario.includes('finished') ? 'finished' as const : scenario.includes('upcoming') ? 'scheduled' as const : 'live' as const,
    events: empty ? [] : many ? Array.from({ length: 85 }, (_, index) => ev({ minute: index + 1, player: `Isolated player ${index}` })) : [...base.events, ...(fresh ? [ev({ minute: 112, player: 'New source event' })] : [])],
    score: { home: fresh ? 5 : 4, away: 2 },
  };
  return <div dir={locale === 'ar' ? 'rtl' : 'ltr'} className="space-y-5">
    <p className="text-sm text-amber-200">Isolated browser-test application — synthetic source snapshots, never production football data.</p>
    <h1 className="text-xl font-bold">Source score: <bdi data-testid="source-score">{match.score.home}-{match.score.away}</bdi></h1>
    <button type="button" className="btn-secondary" onClick={() => setFresh(true)}>Supply refreshed source props</button>
    <MatchStory match={match} locale={locale} />
  </div>;
}

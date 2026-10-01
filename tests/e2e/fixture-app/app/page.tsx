import { LiveMatchView } from '../../../../src/features/live/components/LiveMatchView';
import { MatchCard } from '../../../../src/components/match-card';
import { getDictionary } from '../../../../src/i18n/dictionaries';
import type { UnifiedMatch } from '../../../../src/lib/types';
import { makeFixture } from '../fixture';

export default async function FixturePage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const catalog = makeFixture(mode);
  const match = catalog.matches[0];
  const scoreCard: UnifiedMatch = {
    id: match.matchId, provider: 'test', providerId: 'fixture', utcDate: match.startsAt,
    status: 'live', minute: 30, home: { ...match.home, shortName: null }, away: { ...match.away, shortName: null },
    league: { id: 'TEST', name: 'Synthetic test fixture', code: null, emblem: null, country: null },
    score: { home: 1, away: 0 }, matchday: null, venue: null, referee: null, events: [], lastUpdated: '2026-10-01T19:00:00Z',
  };
  return <><p className="mb-5 text-xs text-amber-300">Isolated browser test application — synthetic sources, no real broadcast.</p><LiveMatchView initial={catalog} initialMatch={match} initialStale={false} renderedAt={Date.parse('2026-10-01T19:00:00Z')} locale="en" /><section className="mt-10" data-testid="existing-score-card"><MatchCard match={scoreCard} locale="en" dict={getDictionary('en')} /></section></>;
}

import type { Metadata } from 'next';
import type { Scorer } from '../../../../../src/lib/types';
import { ScorersTable } from '../../../../../src/components/scorers-table';
import { getDictionary } from '../../../../../src/i18n/dictionaries';
import { FavoriteButton } from '../../../../../src/features/personalization/components/FavoriteButton';
import { favoriteForSquadPlayer } from '../../../../../src/features/personalization/lib/catalog';

export const metadata: Metadata = { title: 'Isolated personalisation tests', robots: { index: false, follow: false } };

// This fixture belongs to the SEPARATE test app, not src/app or public data.
const scorers: Scorer[] = [
  { rank: 1, playerId: '101', name: 'Test player with ID', team: { id: 'fd~57', name: 'Test club', shortName: null, crest: null }, goals: 2, assists: null, penalties: null, played: 1 },
  { rank: 2, playerId: null, name: 'Test player without ID', team: { id: 'fd~57', name: 'Test club', shortName: null, crest: null }, goals: 1, assists: null, penalties: null, played: 1 },
  { rank: 3, playerId: '101', name: 'Test player other provider', team: { id: 'af~57', name: 'Other test club', shortName: null, crest: null }, goals: 1, assists: null, penalties: null, played: 1 },
];
export default function PersonalisationFixture() {
  const squadFavorite = favoriteForSquadPlayer(
    { id: '101', name: 'Test player with ID', position: 'Forward', nationality: null, dateOfBirth: null, shirtNumber: null },
    { id: 'fd~57', name: 'Test club', crest: null, leagueCode: 'PL' },
  );
  return <>
    <p className="mb-5 text-sm text-amber-200">Isolated browser test application — synthetic player statistics, never production football data.</p>
    <h1 className="mb-5 text-xl font-bold text-white">Player follow contract</h1>
    <ScorersTable scorers={scorers} locale="en" dict={getDictionary('en')} leagueCode="PL" />
    <section aria-label="Squad source" className="mt-5 card flex items-center justify-between p-5"><span className="text-sm">Same provider ID in a squad</span>{squadFavorite && <FavoriteButton favorite={squadFavorite} locale="en" />}</section>
  </>;
}

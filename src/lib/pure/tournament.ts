/**
 * ESPN tournament (group + knockout cup) mapping — pure.
 *
 * Shape verified against real, live ESPN hidden-API responses before this
 * module was written (2026 FIFA World Cup, 2025 Africa Cup of Nations):
 *   - `GET /apis/v2/sports/soccer/{slug}/standings?season={year}` returns
 *     `children[]`, one per group, each with `standings.entries[]`
 *     (team + stats[] + an optional qualification `note`).
 *   - `GET /apis/site/v2/sports/soccer/{slug}/scoreboard?dates={year}&limit=300`
 *     returns every match of the tournament in one call, each tagged with
 *     `season.slug` (round, e.g. "group-stage", "semifinals") and, for group
 *     matches, `competitions[0].group.name` ("Group A").
 * Nothing here is invented: a row only exists if ESPN actually returned it.
 */

export interface TournamentTeamRef {
  id: string;
  name: string;
  crest: string | null;
}

export interface TournamentStandingRow {
  position: number;
  team: TournamentTeamRef;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  group: string | null;
  note: string | null;
}

interface EspnStat {
  type?: string;
  value?: number;
}

interface EspnStandingsEntry {
  team?: { id?: string; displayName?: string; shortDisplayName?: string; logos?: { href?: string }[] };
  note?: { description?: string };
  stats?: EspnStat[];
}

interface EspnStandingsGroup {
  name?: string;
  standings?: { entries?: EspnStandingsEntry[] };
}

export interface EspnStandingsResponse {
  children?: EspnStandingsGroup[];
}

function statValue(stats: EspnStat[] | undefined, type: string): number {
  const found = stats?.find((s) => s.type === type);
  return typeof found?.value === 'number' ? found.value : 0;
}

/** Maps one raw ESPN tournament-standings payload into flat, group-tagged rows. */
export function mapTournamentStandings(
  data: EspnStandingsResponse,
  idOf: (teamId: string) => string,
): TournamentStandingRow[] {
  const rows: TournamentStandingRow[] = [];
  for (const group of data.children ?? []) {
    const groupName = group.name ?? null;
    for (const entry of group.standings?.entries ?? []) {
      const teamId = entry.team?.id;
      if (!teamId) continue;
      const rank = statValue(entry.stats, 'rank');
      rows.push({
        position: rank > 0 ? rank : rows.length + 1,
        team: {
          id: idOf(teamId),
          name: entry.team?.displayName || entry.team?.shortDisplayName || '',
          crest: entry.team?.logos?.[0]?.href ?? null,
        },
        played: statValue(entry.stats, 'gamesplayed'),
        won: statValue(entry.stats, 'wins'),
        draw: statValue(entry.stats, 'ties'),
        lost: statValue(entry.stats, 'losses'),
        goalsFor: statValue(entry.stats, 'pointsfor'),
        goalsAgainst: statValue(entry.stats, 'pointsagainst'),
        goalDifference: statValue(entry.stats, 'pointdifferential'),
        points: statValue(entry.stats, 'points'),
        group: groupName,
        note: entry.note?.description ?? null,
      });
    }
  }
  return rows;
}

/** Known ESPN round slugs in play order, for sorting a mixed schedule. */
const ROUND_ORDER = [
  'group-stage',
  'round-of-32',
  'round-of-16',
  'quarterfinals',
  'semifinals',
  'third-place',
  'final',
];

export function roundSortKey(slug: string | null): number {
  if (!slug) return ROUND_ORDER.length + 1;
  const i = ROUND_ORDER.indexOf(slug);
  return i === -1 ? ROUND_ORDER.length : i;
}

/** English fallback label for a round slug ESPN hasn't been mapped for in i18n yet. */
export function fallbackRoundLabel(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

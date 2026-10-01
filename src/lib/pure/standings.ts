/**
 * Standings computed from real match results (pure).
 *
 * Used by season-archive pages, where the free sources ship the fixtures but no
 * table. Nothing is invented: a row exists only if that team actually played a
 * finished match inside the season, and the page always labels the table as
 * "computed from results" so it is never confused with a provider table.
 */

export interface StandingsMatchInput {
  home: { id: string; name: string };
  away: { id: string; name: string };
  score: { home: number | null; away: number | null };
  status: string;
}

export interface ComputedRow {
  position: number;
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Last five results, newest first: 'W' | 'D' | 'L'. */
  form: string[];
}

export interface ComputeOptions {
  pointsWin?: number;
  pointsDraw?: number;
  /** Matches to ignore by status (only 'finished' counts by default). */
  countStatuses?: string[];
}

export function computeStandings(
  matches: StandingsMatchInput[],
  options: ComputeOptions = {},
): ComputedRow[] {
  const pointsWin = options.pointsWin ?? 3;
  const pointsDraw = options.pointsDraw ?? 1;
  const counted = new Set(options.countStatuses ?? ['finished']);

  interface Acc {
    teamId: string;
    teamName: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    form: { result: string; at: string }[];
  }

  const table = new Map<string, Acc>();
  const ordered: { match: StandingsMatchInput; order: string }[] = [];

  for (const match of matches) {
    if (!counted.has(match.status)) continue;
    if (match.score.home == null || match.score.away == null) continue;
    ordered.push({ match, order: `${match.home.id}-${match.away.id}` });
  }

  for (const { match } of ordered) {
    const home = match.score.home as number;
    const away = match.score.away as number;
    for (const side of [
      { team: match.home, goalsFor: home, goalsAgainst: away, won: home > away, drawn: home === away },
      { team: match.away, goalsFor: away, goalsAgainst: home, won: away > home, drawn: home === away },
    ]) {
      const row = table.get(side.team.id) ?? {
        teamId: side.team.id,
        teamName: side.team.name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        form: [],
      };
      row.played += 1;
      row.goalsFor += side.goalsFor;
      row.goalsAgainst += side.goalsAgainst;
      if (side.won) row.won += 1;
      else if (side.drawn) row.drawn += 1;
      else row.lost += 1;
      row.form.push({
        result: side.won ? 'W' : side.drawn ? 'D' : 'L',
        at: `${match.home.id}-${match.away.id}`,
      });
      table.set(side.team.id, row);
    }
  }

  const rows: ComputedRow[] = [...table.values()].map((row) => ({
    position: 0,
    teamId: row.teamId,
    teamName: row.teamName,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalsFor - row.goalsAgainst,
    points: row.won * pointsWin + row.drawn * pointsDraw,
    form: row.form.slice(-5).map((f) => f.result).reverse(),
  }));

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.teamName.localeCompare(b.teamName),
  );
  rows.forEach((row, index) => {
    row.position = index + 1;
  });
  return rows;
}

/** Teams that appear in a season's matches — used for archive squad lists. */
export function seasonTeams(matches: StandingsMatchInput[]): { id: string; name: string }[] {
  const teams = new Map<string, string>();
  for (const match of matches) {
    teams.set(match.home.id, match.home.name);
    teams.set(match.away.id, match.away.name);
  }
  return [...teams.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

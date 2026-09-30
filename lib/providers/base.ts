import type {
  Scorer,
  StandingRow,
  UnifiedLeague,
  UnifiedMatch,
  UnifiedTeam,
} from '@/lib/types';

/**
 * Provider adapter contract. Adapters throw ProviderError('unsupported')
 * for capabilities they don't offer; the fallback layer then moves on.
 */
export interface FootballProvider {
  readonly id: string;
  readonly name: string;
  enabled(): boolean;

  /** all matches currently in play across known competitions */
  getLiveMatches(): Promise<UnifiedMatch[]>;
  /** matches for a calendar date, ISO yyyy-mm-dd */
  getMatchesByDate(date: string): Promise<UnifiedMatch[]>;
  /** matches across an inclusive date range, ISO yyyy-mm-dd */
  getMatchesByRange(from: string, to: string): Promise<UnifiedMatch[]>;
  getMatch(providerIdParts: string[]): Promise<UnifiedMatch | null>;
  getLeagues(): Promise<UnifiedLeague[]>;
  /** recent + upcoming matches for a league code */
  getLeagueMatches(leagueCode: string): Promise<UnifiedMatch[]>;
  getStandings(leagueCode: string): Promise<StandingRow[]>;
  getScorers(leagueCode: string): Promise<Scorer[]>;
  getTeams(leagueCode: string): Promise<UnifiedTeam[]>;
  getTeam(providerIdParts: string[]): Promise<UnifiedTeam | null>;
  /** last N finished / next N scheduled matches for a team */
  getTeamMatches(providerIdParts: string[], kind: 'recent' | 'upcoming'): Promise<UnifiedMatch[]>;
  /** team search by free-text name */
  searchTeams(query: string): Promise<UnifiedTeam[]>;
}

export interface LeagueMeta {
  code: string;
  name: string;
  country: string;
}

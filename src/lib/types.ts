/**
 * KoraScore unified data model.
 * Every provider adapter normalizes its responses into these shapes,
 * so the rest of the app never touches provider-specific payloads.
 */

export type MatchStatus =
  | 'scheduled'
  | 'live'
  | 'halftime'
  | 'finished'
  | 'postponed'
  | 'cancelled';

export interface TeamRef {
  id: string;
  name: string;
  shortName: string | null;
  crest: string | null;
}

export interface LeagueRef {
  id: string;
  code: string | null;
  name: string;
  emblem: string | null;
  country: string | null;
}

export interface MatchEvent {
  type: 'goal' | 'own_goal' | 'penalty_goal' | 'yellow' | 'red' | 'yellow_red' | 'sub';
  minute: number | null;
  extraMinute: number | null;
  teamId: string | null;
  player: string | null;
  assist: string | null;
  playerOut: string | null;
  playerIn: string | null;
}

export interface MatchScore {
  home: number | null;
  away: number | null;
  /** half-time score when known */
  htHome?: number | null;
  htAway?: number | null;
  pensHome?: number | null;
  pensAway?: number | null;
}

export interface UnifiedMatch {
  /** prefixed, route-safe id e.g. "fd~123456" */
  id: string;
  provider: string;
  providerId: string;
  utcDate: string; // ISO
  status: MatchStatus;
  minute: number | null;
  home: TeamRef;
  away: TeamRef;
  score: MatchScore;
  league: LeagueRef;
  matchday: number | null;
  venue: string | null;
  referee: string | null;
  events: MatchEvent[];
  lastUpdated: string; // ISO
}

export interface StandingRow {
  position: number;
  team: TeamRef;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string | null;
  zone: 'champions' | 'europe' | 'relegation' | null;
  group: string | null;
  /** Short qualification/elimination note (cup group stages only), e.g. "Qualifies for round of 16". */
  note?: string | null;
}

export interface Scorer {
  rank: number;
  playerId: string | null;
  name: string;
  team: TeamRef;
  goals: number;
  assists: number | null;
  penalties: number | null;
  played: number | null;
}

export interface SquadPlayer {
  id: string | null;
  name: string;
  position: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  shirtNumber: number | null;
}

export interface UnifiedTeam {
  id: string;
  provider: string;
  providerId: string;
  name: string;
  shortName: string | null;
  crest: string | null;
  country: string | null;
  founded: number | null;
  venue: string | null;
  website: string | null;
  coach: string | null;
  squad: SquadPlayer[];
  leagueCode: string | null;
}

export interface UnifiedLeague {
  id: string;
  code: string | null;
  name: string;
  emblem: string | null;
  country: string | null;
  currentSeason: {
    startDate: string | null;
    endDate: string | null;
    currentMatchday: number | null;
  } | null;
}

/** Result envelope carrying provenance for UI notices + debugging. */
export interface DataResult<T> {
  data: T;
  source: string; // provider id that served the data, or 'cache'
  stale: boolean; // true when served from fallback cache after provider failure
  fetchedAt: string; // ISO
}

export interface LeagueSearchHit {
  kind: 'league';
  id: string;
  code: string | null;
  name: string;
  emblem: string | null;
  country: string | null;
}

export interface TeamSearchHit {
  kind: 'team';
  id: string;
  name: string;
  crest: string | null;
  league: string | null;
  country: string | null;
}

export type SearchHit = LeagueSearchHit | TeamSearchHit;

/**
 * A third-party news headline. We store only what we are allowed to republish:
 * title, short excerpt, timestamp, source credit and the canonical link.
 */
export type { FeedItem as NewsItem } from './pure/rss';

/** An entity link attached to a news item (team/league/country). */
export interface NewsEntityLink {
  id: string;
  name: string;
}

export type NewsKind =
  | 'match'
  | 'transfer'
  | 'injury'
  | 'coach'
  | 'competition'
  | 'national'
  | 'general';

export type NewsHubSection =
  | 'latest'
  | 'egypt'
  | 'arab'
  | 'england'
  | 'spain'
  | 'italy'
  | 'germany'
  | 'france'
  | 'africa'
  | 'europe'
  | 'world';

/**
 * A headline after the intelligence pipeline: language, type, linked entities,
 * hub section and (when licensed) an image. Never contains article text.
 */
export interface NewsEntry {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceUrl: string;
  publishedAt: string | null;
  excerpt: string;
  imageUrl?: string | null;
  language: 'ar' | 'en' | 'other';
  category: NewsKind;
  hub: NewsHubSection;
  entities: NewsEntityLink[];
}

/** One real-world story, possibly covered by several sources. */
export interface NewsStory {
  id: string;
  entry: NewsEntry;
  /** Every source that covered the same story (including the representative). */
  coverage: NewsEntityLink[];
  related: NewsEntry[];
  itemCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
}

export interface NewsSourceHealthView {
  id: string;
  name: string;
  language: 'ar' | 'en' | 'multi';
  status: string;
  state: 'closed' | 'open' | 'half-open' | 'idle';
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  avgLatencyMs: number;
  attributionRequired: boolean;
}


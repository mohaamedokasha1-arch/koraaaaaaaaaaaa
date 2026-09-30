/**
 * Provider Registry (spec §5.1).
 *
 * One machine-readable description per data source: what it can serve, where it
 * is allowed to be used, what it costs in quota terms and how it is enabled.
 * Adding a source means adding an adapter + one entry here — the routing chains
 * and the UI stay untouched. Served by /api/health so operators can see which
 * sources are live, opted-in or dormant.
 */

export type SourceKind = 'keyed-api' | 'public-api' | 'open-dataset' | 'rss';

export interface ProviderDescriptor {
  id: string;
  name: string;
  kind: SourceKind;
  /** Capabilities this adapter can serve (matches registry chain keys). */
  capabilities: string[];
  /** Leagues/regions the source actually covers today (as verified). */
  coverage: string;
  /** Env var that must be present for the adapter to run. */
  envKey?: string;
  /** Env var that turns the source off (default state documented in `status`). */
  disableEnv?: string;
  /** 'active' = used automatically, 'opt-in' = inert until configured. */
  status: 'active' | 'opt-in';
  quota: string;
  licence: string;
  /** What the terms allow/require when displaying the data publicly. */
  displayTerms: string;
  attributionRequired: boolean;
}

export const PROVIDER_CATALOG: ProviderDescriptor[] = [
  {
    id: 'fd',
    name: 'football-data.org',
    kind: 'keyed-api',
    capabilities: ['live', 'matchesByDate', 'matchesByRange', 'match', 'leagues', 'leagueMatches', 'standings', 'scorers', 'leagueTeams', 'team', 'teamMatches'],
    coverage: 'Free tier: 10 tracked competitions (PL, PD, SA, BL1, FL1, CL, DED, PPL, BSA, ELC). Standings, fixtures, results, scorers, team profiles.',
    envKey: 'FOOTBALL_DATA_API_TOKEN',
    status: 'active',
    quota: 'Free plan 10 requests/minute — the adapter token-buckets at 8/min with 2 in reserve.',
    licence: 'Provider terms; free tier for non-commercial/limited use, paid tiers for commercial products.',
    displayTerms: 'Display of scores/tables permitted under the provider agreement; plan upgrades are a business decision.',
    attributionRequired: false,
  },
  {
    id: 'af',
    name: 'api-football (API-SPORTS)',
    kind: 'keyed-api',
    capabilities: ['live', 'matchesByDate', 'matchesByRange', 'match', 'leagueMatches', 'standings', 'scorers', 'leagueTeams'],
    coverage: '1,200+ competitions including the Egyptian Premier League (233) when a key is configured.',
    envKey: 'API_FOOTBALL_KEY',
    status: 'active',
    quota: 'Free: 100 requests/day, 10/min. Paid plans raise the ceiling.',
    licence: 'API-SPORTS terms — commercial use allowed on all tiers.',
    displayTerms: 'Public display allowed; keep the key server-side.',
    attributionRequired: false,
  },
  {
    id: 'espn',
    name: 'ESPN public scoreboard',
    kind: 'public-api',
    capabilities: ['live', 'matchesByDate', 'matchesByRange', 'match'],
    coverage: 'Broad scoreboard coverage for major world competitions (used as a fallback tier).',
    disableEnv: 'ESPN_PROVIDER_ENABLED',
    status: 'active',
    quota: 'Undocumented public endpoint — used sparingly and only as a fallback; results are cached server-side.',
    licence: 'ESPN public endpoints; no key. Trademarks and logos remain ESPN/league property.',
    displayTerms: 'Used as a score fallback only; no ESPN branding or logos are reproduced.',
    attributionRequired: false,
  },
  {
    id: 'tsdb',
    name: 'TheSportsDB',
    kind: 'public-api',
    capabilities: ['live', 'matchesByDate', 'matchesByRange', 'match', 'leagueMatches', 'standings', 'leagueTeams', 'team', 'teamMatches', 'searchTeams'],
    coverage: '617 football leagues incl. Egyptian Premier League (league 4829). Free key caps tables at 5 rows, schedules at 15 events, club lists at 10 — the adapter returns exactly what the plan authorises.',
    envKey: 'THESPORTSDB_API_KEY',
    status: 'active',
    quota: 'Public key "3": ~30 req/min with per-endpoint caps; Patreon key raises caps.',
    licence: 'Crowd-sourced database. Public/free key is for non-commercial use; commercial use requires the supporter tier.',
    displayTerms: 'Community-maintained data — shown as-is; commercial use requires the paid supporter tier.',
    attributionRequired: false,
  },
  {
    id: 'ofb',
    name: 'openfootball (football.json + world)',
    kind: 'open-dataset',
    capabilities: ['historicalMatches'],
    coverage: 'Completed seasons since 2010/11 for major European leagues (eng/spa/ita/ger/fra/ned/por/aut/bel/gre/sco/tur) and the Egyptian Premier League (2023-24, 2024-25).',
    disableEnv: 'OPENFOOTBALL_ENABLED',
    status: 'active',
    quota: 'No key and no documented rate limit; files are fetched once per season and cached 24h.',
    licence: 'CC0-1.0 / public domain ("use as you please with no restrictions whatsoever").',
    displayTerms: 'Public display allowed without restriction; the UI still credits the dataset as good practice.',
    attributionRequired: false,
  },
  {
    id: 'rss',
    name: 'Licensed news feeds (RSS/Atom)',
    kind: 'rss',
    capabilities: ['news'],
    coverage: 'Whatever the operator configures in NEWS_FEEDS — e.g. BBC Sport football, publisher feeds.',
    envKey: 'NEWS_FEEDS',
    status: 'opt-in',
    quota: 'Per-feed; the service caches every feed for 10 minutes and issues at most one request per feed per window.',
    licence: 'Each feed keeps its own terms (e.g. BBC Sport RSS: visible "BBC Sport" credit required; business use needs BBC permission).',
    displayTerms: 'Headline + short excerpt + timestamp + source credit + link only. Never the full article. The operator opts in per feed.',
    attributionRequired: true,
  },
];

export function catalogEntry(id: string): ProviderDescriptor | undefined {
  return PROVIDER_CATALOG.find((p) => p.id === id);
}

/** Short, public-safe summary for monitoring endpoints (no secrets, no URLs). */
export function catalogSummary() {
  return PROVIDER_CATALOG.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    capabilities: p.capabilities,
    status: p.status,
    enabled: p.envKey ? Boolean(process.env[p.envKey]) : p.disableEnv ? process.env[p.disableEnv] !== 'false' : true,
    quota: p.quota,
    licence: p.licence,
  }));
}

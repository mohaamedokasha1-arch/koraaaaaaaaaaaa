import 'server-only';
import type { UnifiedMatch } from '@/lib/types';
import { encodeEntityId, leagueByCode } from '@/lib/constants';
import { allowRequest, recordFailure, recordSuccess } from '@/lib/circuit';
import { fetchJson, fetchText, ProviderError } from './http';
import { parseFootballTxt, zonedToUtc, type TxtLine } from '@/lib/pure/footballTxt';

/**
 * openfootball — free, open, public-domain (CC0) football datasets.
 *
 * Licence verified in-repo: "The football.db schema, data and scripts are
 * dedicated to the public domain. Use as you please with no restrictions
 * whatsoever." (openfootball/world README + CC0-1.0 on every dataset repo).
 * No API key, no documented rate limit; the datasets are static files served
 * from raw.githubusercontent.com, refreshed by the project's own bots.
 *
 * Scope by design (see docs/SOURCE-EVALUATION.md):
 *   • HISTORICAL, completed seasons only — never used for live scores.
 *   • It never overrides a working live provider; it fills the history gap
 *     (including the Egyptian Premier League, which the free live providers
 *     do not cover historically).
 *   • Plain per-season files only; no scraping, no undocumented endpoints.
 */

const ENABLED = (process.env.OPENFOOTBALL_ENABLED ?? 'true') !== 'false';
const JSON_BASE = 'https://raw.githubusercontent.com/openfootball/football.json/master';
const WORLD_BASE = 'https://raw.githubusercontent.com/openfootball/world/master';
const PROVIDER_ID = 'ofb';
const TIMEOUT_MS = Number(process.env.OPENFOOTBALL_TIMEOUT_MS ?? 10_000);

export const OPENFOOTBALL_ATTRIBUTION = {
  name: 'openfootball',
  url: 'https://github.com/openfootball/football.json',
  licence: 'CC0-1.0 / public domain',
} as const;

export function openFootballEnabled(): boolean {
  return ENABLED;
}

/** Where a league's historical results live in the openfootball datasets. */
export interface HistoricalSource {
  /** Dataset file key, e.g. 'en.1' (football.json) */
  file?: string;
  /** football.json season folder, e.g. '2024-25' */
  season?: string;
  /** Football.TXT dataset inside openfootball/world (Egypt etc.) */
  worldPath?: string;
  /** Season file suffix for world datasets, e.g. 'eg1' → 2024-25_eg1.txt */
  worldSuffix?: string;
  /** Attribution link for this specific dataset */
  datasetUrl: string;
}

interface FootballJsonMatch {
  round?: string;
  date?: string;
  time?: string;
  team1?: string;
  team2?: string;
  score?: { ft?: number[]; ht?: number[] } | number[] | null;
}

interface FootballJsonSeason {
  name?: string;
  matches?: FootballJsonMatch[];
}

function parseJsonScore(score: FootballJsonMatch['score']): { ft: [number, number] | null; ht: [number, number] | null } {
  if (!score) return { ft: null, ht: null };
  if (Array.isArray(score)) return { ft: score.length === 2 ? [score[0], score[1]] : null, ht: null };
  const ft = Array.isArray(score.ft) && score.ft.length === 2 ? ([score.ft[0], score.ft[1]] as [number, number]) : null;
  const ht = Array.isArray(score.ht) && score.ht.length === 2 ? ([score.ht[0], score.ht[1]] as [number, number]) : null;
  return { ft, ht };
}

function roundNumber(round: string | undefined): number | null {
  if (!round) return null;
  const m = /(\d+)/.exec(round);
  return m ? Number(m[1]) : null;
}

/** kickoff: local wall-clock time in the league's country; openfootball JSON is European local time. */
function isoFrom(date: string | undefined, time: string | undefined): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t = time && /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, '0') : '00:00';
  return `${date}T${t}:00`;
}

function mapJsonMatch(
  m: FootballJsonMatch,
  index: number,
  leagueCode: string,
  season: string,
): UnifiedMatch | null {
  const league = leagueByCode(leagueCode);
  if (!league || !m.team1 || !m.team2) return null;
  const kickoff = isoFrom(m.date, m.time);
  if (!kickoff) return null;
  const { ft, ht } = parseJsonScore(m.score);

  return {
    id: encodeEntityId('ofb', leagueCode, season, index),
    provider: 'ofb',
    providerId: `${leagueCode}-${season}-${index}`,
    utcDate: kickoff,
    status: ft ? 'finished' : 'scheduled',
    minute: null,
    home: { id: encodeEntityId('ofb', m.team1), name: m.team1, shortName: null, crest: null },
    away: { id: encodeEntityId('ofb', m.team2), name: m.team2, shortName: null, crest: null },
    score: { home: ft?.[0] ?? null, away: ft?.[1] ?? null, htHome: ht?.[0] ?? null, htAway: ht?.[1] ?? null },
    league: {
      id: `ofb~${leagueCode}`,
      code: league.fdCode,
      name: league.nameEn,
      emblem: league.emblem,
      country: league.country,
    },
    matchday: roundNumber(m.round),
    venue: null,
    referee: null,
    events: [],
    lastUpdated: new Date().toISOString(),
  };
}

function mapTxtLine(line: TxtLine, index: number, leagueCode: string, season: string): UnifiedMatch | null {
  const league = leagueByCode(leagueCode);
  if (!league) return null;
  return {
    id: encodeEntityId('ofb', leagueCode, season, index),
    provider: 'ofb',
    providerId: `${leagueCode}-${season}-${index}`,
    utcDate: zonedToUtc(line.date, line.time, 'Africa/Cairo'),
    status: 'finished',
    minute: null,
    home: { id: encodeEntityId('ofb', line.home), name: line.home, shortName: null, crest: null },
    away: { id: encodeEntityId('ofb', line.away), name: line.away, shortName: null, crest: null },
    score: {
      home: line.ft[0], away: line.ft[1],
      htHome: line.ht?.[0] ?? null, htAway: line.ht?.[1] ?? null,
    },
    league: {
      id: `ofb~${leagueCode}`,
      code: league.fdCode,
      name: league.nameEn,
      emblem: league.emblem,
      country: league.country,
    },
    matchday: line.matchday,
    venue: null,
    referee: null,
    events: [],
    lastUpdated: new Date().toISOString(),
  };
}

/** Fetch a whole historical season for a league from the matching dataset. */
export async function fetchHistoricalSeason(
  source: HistoricalSource,
  leagueCode: string,
  season: string,
): Promise<UnifiedMatch[]> {
  if (!ENABLED) throw new ProviderError('openfootball disabled by env', 'unsupported');
  if (!allowRequest(PROVIDER_ID)) throw new ProviderError('openfootball circuit open', 'network');

  const started = Date.now();
  try {
    let matches: UnifiedMatch[] = [];

    if (source.worldPath && source.worldSuffix) {
      const url = `${WORLD_BASE}/${source.worldPath}/${season}_${source.worldSuffix}.txt`;
      const raw = await fetchText(url, { timeoutMs: TIMEOUT_MS });
      const lines = parseFootballTxt(raw, season);
      matches = lines
        .map((l, i) => mapTxtLine(l, i, leagueCode, season))
        .filter((m): m is UnifiedMatch => m !== null);
    } else if (source.file) {
      const url = `${JSON_BASE}/${season}/${source.file}.json`;
      const doc = await fetchJson<FootballJsonSeason>(url, { timeoutMs: TIMEOUT_MS });
      matches = (doc.matches ?? [])
        .map((m, i) => mapJsonMatch(m, i, leagueCode, season))
        .filter((m): m is UnifiedMatch => m !== null);
    } else {
      throw new ProviderError(`openfootball has no dataset for ${leagueCode}`, 'unsupported');
    }

    if (matches.length === 0) {
      // A dataset that exists but is empty for this season is honest "no data".
      recordSuccess(PROVIDER_ID, Date.now() - started);
      return [];
    }

    matches.sort((a, b) => a.utcDate.localeCompare(b.utcDate));
    recordSuccess(PROVIDER_ID, Date.now() - started);
    return matches;
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    if (e instanceof ProviderError && e.kind === 'unsupported') throw e;
    recordFailure(PROVIDER_ID, e.message.slice(0, 200));
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(`openfootball fetch failed: ${e.message}`, 'network');
  }
}

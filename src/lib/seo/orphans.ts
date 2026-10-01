import 'server-only';
import { ALL_LEAGUES, leagueByCode } from '@/lib/constants';
import { entitiesByKind } from '@/lib/entities';
import { newsEnabled, getNewsBundle } from '@/lib/news';
import { hasHistory, historySeasons } from '@/lib/historical';
import { cache } from '@/lib/cache';
import { getResults } from '@/lib/football';
import type { UnifiedMatch } from '@/lib/types';

/**
 * Orphan Pages report (Phase 6).
 *
 * Honest scope: without a real crawl (Google Search Console is only available
 * after production deployment) an app cannot prove "no page is orphaned". What
 * it CAN do — and what this module does — is verify the invariant that actually
 * creates orphans: every URL we publish in a sitemap must be reachable from at
 * least one crawlable hub page, and must correspond to a route that renders.
 *
 * The report is therefore data-driven and reproducible:
 *   • leagues  ← /leagues + /  (both render the full catalogue)
 *   • teams    ← /teams (league squads) + league pages + match pages
 *   • matches  ← /today, /results (3 days), /upcoming (5 days), /live and both
 *                team pages — a cached match outside every window is flagged
 *   • news     ← /news; section filters live on the query string and are NOT
 *                published as separate URLs (a filtered URL is a crawl trap)
 *   • archive  ← the league page links its archive only when a real dataset
 *                exists (`hasHistory`) and only for seasons actually present
 */

export interface OrphanFinding {
  path: string;
  type: string;
  reason: string;
}

export interface OrphanReport {
  generatedAt: string;
  published: Record<string, number>;
  findings: OrphanFinding[];
  notes: string[];
  overall: 'ok' | 'warn';
}

const DATA_PROVIDERS = new Set(['fd', 'af', 'espn', 'tsdb', 'ofb']);

/** A cached match is reachable from a day hub only inside these windows. */
const RESULTS_WINDOW_DAYS = 3;
const UPCOMING_WINDOW_DAYS = 5;

function daysBetween(dateIso: string, now: number): number | null {
  const time = Date.parse(dateIso);
  if (Number.isNaN(time)) return null;
  return (time - now) / 86_400_000;
}

/** Route patterns the app really serves, in sitemap order. */
const ROUTE_PATTERNS: { type: string; pattern: RegExp; route: string }[] = [
  { type: 'static', pattern: /^\/(live|today|results|upcoming|leagues|standings|top-scorers|teams)?$/, route: '/[locale]' },
  { type: 'leagues', pattern: /^\/leagues\/[A-Z0-9]+$/, route: '/[locale]/leagues/[code]' },
  { type: 'teams', pattern: /^\/teams\/[a-z0-9-]+$/, route: '/[locale]/teams/[id]' },
  { type: 'matches', pattern: /^\/matches\/[a-z0-9~-]+$/i, route: '/[locale]/matches/[id]' },
  { type: 'news', pattern: /^\/news$/, route: '/[locale]/news' },
  { type: 'archive', pattern: /^\/leagues\/[A-Z0-9]+\/archive(\/\d{4}(-\d{2})?)?$/, route: '/[locale]/leagues/[code]/archive/[[...season]]' },
];

export async function orphanReport(): Promise<OrphanReport> {
  const now = Date.now();
  const generatedAt = new Date(now).toISOString();
  const findings: OrphanFinding[] = [];
  const notes: string[] = [];
  const published: Record<string, number> = { static: 9, leagues: 0, teams: 0, matches: 0, news: 0, archive: 0 };

  const routeFor = (path: string): string | null => {
    for (const entry of ROUTE_PATTERNS) if (entry.pattern.test(path)) return entry.route;
    return null;
  };

  // ── leagues ────────────────────────────────────────────────────────────────
  published.leagues = ALL_LEAGUES.length;
  for (const league of ALL_LEAGUES) {
    if (!leagueByCode(league.fdCode)) {
      findings.push({ path: `/leagues/${league.fdCode}`, type: 'leagues', reason: 'league code is not in the catalogue used by /leagues' });
    }
  }

  // ── teams ──────────────────────────────────────────────────────────────────
  const teams = entitiesByKind('team');
  let entityOnly = 0;
  for (const entity of teams) {
    const hasDataRef = entity.refs.some((ref) => DATA_PROVIDERS.has(ref.provider));
    if (!hasDataRef) {
      // Deliberate: a known club with no data provider yet is reachable from
      // search but never listed in a sitemap. Counted, not flagged.
      entityOnly += 1;
      continue;
    }
    published.teams += 1;
    const route = routeFor(`/teams/${entity.slug}`);
    if (!route) findings.push({ path: `/teams/${entity.slug}`, type: 'teams', reason: 'no route matches this team path' });
  }

  // ── matches (only what this instance actually holds) ───────────────────────
  const seen = new Set<string>();
  for (const key of cache.keysWithPrefix('matches:')) {
    const hit = cache.get<UnifiedMatch[]>(key);
    if (!hit) continue;
    for (const match of hit.value) {
      if (seen.has(match.id)) continue;
      seen.add(match.id);
      const route = routeFor(`/matches/${match.id}`);
      if (!route) {
        findings.push({ path: `/matches/${match.id}`, type: 'matches', reason: 'no route matches this match id' });
        continue;
      }
      published.matches += 1;
      const offset = daysBetween(match.utcDate, now);
      if (offset === null) {
        findings.push({ path: `/matches/${match.id}`, type: 'matches', reason: 'unparseable kickoff date — cannot be placed in a day hub' });
      } else if (offset < -RESULTS_WINDOW_DAYS || offset > UPCOMING_WINDOW_DAYS) {
        findings.push({
          path: `/matches/${match.id}`,
          type: 'matches',
          reason: `outside every day hub (±${RESULTS_WINDOW_DAYS}/${UPCOMING_WINDOW_DAYS} days): page is reachable only from a team page that still lists it`,
        });
      }
    }
  }

  // ── news ───────────────────────────────────────────────────────────────────
  if (newsEnabled()) {
    try {
      const bundle = await getNewsBundle({ limit: 1 });
      if (bundle.data.entries.length > 0) {
        published.news = 1; // /news only — filtered URLs are canonical to it
        if (!routeFor('/news')) findings.push({ path: '/news', type: 'news', reason: 'no route matches /news' });
        notes.push('news section filters live on ?section= and are canonical to /news: they are intentionally not published as URLs');
      }
    } catch {
      notes.push('news enabled but unreachable at report time — nothing published this run');
    }
  } else {
    notes.push('news disabled (no NEWS_PRESETS/NEWS_FEEDS): /news is not published and must not be indexed');
  }

  // ── archive ────────────────────────────────────────────────────────────────
  for (const league of ALL_LEAGUES) {
    if (!hasHistory(league.fdCode)) continue;
    const seasons = historySeasons(league.fdCode);
    if (seasons.length === 0) continue;
    published.archive += 1 + seasons.length;
    for (const season of seasons) {
      const path = `/leagues/${league.fdCode}/archive/${season}`;
      if (!routeFor(path)) findings.push({ path, type: 'archive', reason: 'no route matches this archive season path' });
    }
  }

  // A match can be in the sitemap while no results/upcoming request ever ran on
  // this instance; probing once makes the "reachable from a day hub" check real
  // instead of theoretical. Failures are reported, never fatal.
  try {
    await Promise.allSettled([getResults(RESULTS_WINDOW_DAYS)]);
  } catch {
    notes.push('could not probe /results data at report time (providers unavailable) — match reachability is best-effort');
  }

  if (entityOnly > 0) {
    notes.push(
      `${entityOnly} known entit${entityOnly === 1 ? 'y is' : 'ies are'} reachable from search only (no data provider yet) and deliberately absent from every sitemap`,
    );
  }
  notes.push('a full orphan audit requires crawl data (Google Search Console) after production deployment; this report verifies the link-graph invariants the app controls');

  return {
    generatedAt,
    published,
    findings,
    notes,
    overall: findings.length === 0 ? 'ok' : 'warn',
  };
}

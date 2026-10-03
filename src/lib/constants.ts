/**
 * Featured competitions supported by the primary provider's free plan,
 * with cross-provider mapping used to dedupe & fall back.
 */

export interface FeaturedLeague {
  /** Route code — the football-data.org code for competitions it covers,
   *  otherwise the canonical provider-native key (e.g. EGY). */
  fdCode: string;
  /** TheSportsDB league id */
  tsdbId: string;
  /** ESPN slug e.g. eng.1 ('' when ESPN has no scoreboard for the league) */
  espnSlug: string;
  /** api-football numeric league id (fallback provider), when known */
  afLeagueId?: string;
  /** TheSportsDB league name, used by name-scoped endpoints (teams list) */
  tsdbName?: string;
  nameEn: string;
  nameAr: string;
  country: string;
  countryAr: string;
  emblem: string | null;
}

export const FEATURED_LEAGUES: FeaturedLeague[] = [
  {
    fdCode: 'PL', tsdbId: '4328', espnSlug: 'eng.1',
    nameEn: 'Premier League', nameAr: 'الدوري الإنجليزي الممتاز',
    country: 'England', countryAr: 'إنجلترا',
    emblem: 'https://crests.football-data.org/PL.png',
  },
  {
    fdCode: 'PD', tsdbId: '4335', espnSlug: 'esp.1',
    nameEn: 'LaLiga', nameAr: 'الدوري الإسباني',
    country: 'Spain', countryAr: 'إسبانيا',
    emblem: 'https://crests.football-data.org/PD.png',
  },
  {
    fdCode: 'SA', tsdbId: '4332', espnSlug: 'ita.1',
    nameEn: 'Serie A', nameAr: 'الدوري الإيطالي',
    country: 'Italy', countryAr: 'إيطاليا',
    emblem: 'https://crests.football-data.org/SA.png',
  },
  {
    fdCode: 'BL1', tsdbId: '4331', espnSlug: 'ger.1',
    nameEn: 'Bundesliga', nameAr: 'الدوري الألماني',
    country: 'Germany', countryAr: 'ألمانيا',
    emblem: 'https://crests.football-data.org/BL1.png',
  },
  {
    fdCode: 'FL1', tsdbId: '4334', espnSlug: 'fra.1',
    nameEn: 'Ligue 1', nameAr: 'الدوري الفرنسي',
    country: 'France', countryAr: 'فرنسا',
    emblem: 'https://crests.football-data.org/FL1.png',
  },
  {
    fdCode: 'CL', tsdbId: '4480', espnSlug: 'uefa.champions',
    nameEn: 'UEFA Champions League', nameAr: 'دوري أبطال أوروبا',
    country: 'Europe', countryAr: 'أوروبا',
    emblem: 'https://crests.football-data.org/CL.png',
  },
  {
    fdCode: 'DED', tsdbId: '4337', espnSlug: 'ned.1',
    nameEn: 'Eredivisie', nameAr: 'الدوري الهولندي',
    country: 'Netherlands', countryAr: 'هولندا',
    emblem: 'https://crests.football-data.org/DED.png',
  },
  {
    fdCode: 'PPL', tsdbId: '4344', espnSlug: 'por.1',
    nameEn: 'Primeira Liga', nameAr: 'الدوري البرتغالي',
    country: 'Portugal', countryAr: 'البرتغال',
    emblem: 'https://crests.football-data.org/PPL.png',
  },
  {
    fdCode: 'BSA', tsdbId: '4351', espnSlug: 'bra.1',
    nameEn: 'Série A', nameAr: 'الدوري البرازيلي',
    country: 'Brazil', countryAr: 'البرازيل',
    emblem: 'https://crests.football-data.org/BSA.png',
  },
  {
    fdCode: 'ELC', tsdbId: '4329', espnSlug: 'eng.2',
    nameEn: 'Championship', nameAr: 'تشامبيونشيب',
    country: 'England', countryAr: 'إنجلترا',
    emblem: 'https://crests.football-data.org/ELC.png',
  },
];

/**
 * Competitions that are not on football-data.org's free plan, so they are
 * served by the other adapters (TheSportsDB → api-football). They use the exact
 * same model, routes, components and provider pipeline as the featured list —
 * only the data source differs.
 */
export const EXTRA_LEAGUES: FeaturedLeague[] = [
  {
    // Egyptian Premier League (الدوري المصري الممتاز) — TheSportsDB league 4829,
    // api-football league 233. Not covered by football-data.org's free tier.
    fdCode: 'EGY',
    tsdbId: '4829',
    espnSlug: '',
    afLeagueId: '233',
    tsdbName: 'Egyptian Premier League',
    nameEn: 'Egyptian Premier League',
    nameAr: 'الدوري المصري الممتاز',
    country: 'Egypt',
    countryAr: 'مصر',
    emblem: 'https://r2.thesportsdb.com/images/media/league/badge/v0iz601786057987.png',
  },
  {
    // Saudi Pro League (دوري روشن السعودي) — TheSportsDB league 4668,
    // api-football league 307. Verified live 2026-27 table (matchday 7, Al-Hilal
    // top) via a real request on 2026-10-03. Not on football-data's free plan.
    fdCode: 'KSA',
    tsdbId: '4668',
    espnSlug: '',
    afLeagueId: '307',
    tsdbName: 'Saudi-Arabian Pro League',
    nameEn: 'Saudi Pro League',
    nameAr: 'الدوري السعودي للمحترفين',
    country: 'Saudi Arabia',
    countryAr: 'السعودية',
    emblem: 'https://r2.thesportsdb.com/images/media/league/badge/3oov8g1746325357.png',
  },
  {
    // UAE Pro League (دوري المحترفين الإماراتي) — TheSportsDB league 4678,
    // api-football league 301. Verified live via a real request on 2026-10-03.
    fdCode: 'UAE',
    tsdbId: '4678',
    espnSlug: '',
    afLeagueId: '301',
    tsdbName: 'UAE Pro League',
    nameEn: 'UAE Pro League',
    nameAr: 'دوري المحترفين الإماراتي',
    country: 'United Arab Emirates',
    countryAr: 'الإمارات',
    emblem: 'https://r2.thesportsdb.com/images/media/league/badge/95pes01643234997.png',
  },
  {
    // Qatar Stars League (دوري نجوم قطر) — TheSportsDB league 4663,
    // api-football league 305. Verified live via a real request on 2026-10-03.
    fdCode: 'QAT',
    tsdbId: '4663',
    espnSlug: '',
    afLeagueId: '305',
    tsdbName: 'Qatar Stars League',
    nameEn: 'Qatar Stars League',
    nameAr: 'دوري نجوم قطر',
    country: 'Qatar',
    countryAr: 'قطر',
    emblem: 'https://r2.thesportsdb.com/images/media/league/badge/hekdan1784606842.png',
  },
];

/** Every league the UI may navigate to (featured + provider-native extras). */
export const ALL_LEAGUES: FeaturedLeague[] = [...FEATURED_LEAGUES, ...EXTRA_LEAGUES];

/** True when football-data.org serves this competition (its code is an fd code). */
export function isFdCovered(code: string): boolean {
  return FEATURED_LEAGUES.some((l) => l.fdCode === code);
}

export function featuredByFdCode(code: string): FeaturedLeague | undefined {
  return FEATURED_LEAGUES.find((l) => l.fdCode === code);
}

export function featuredByTsdbId(id: string): FeaturedLeague | undefined {
  if (!id) return undefined;
  return ALL_LEAGUES.find((l) => l.tsdbId === id) ?? undefined;
}

export function featuredByEspnSlug(slug: string): FeaturedLeague | undefined {
  if (!slug) return undefined;
  return FEATURED_LEAGUES.find((l) => l.espnSlug === slug);
}

/** Any known league (featured or extra) by its route code. */
export function leagueByCode(code: string | null | undefined): FeaturedLeague | undefined {
  if (!code) return undefined;
  return ALL_LEAGUES.find((l) => l.fdCode === code);
}

/** Route-safe canonical id of a league entity: fd ids for fd competitions,
 *  provider-native ids for the extra ones. */
export function leagueEntityId(league: FeaturedLeague): string {
  return isFdCovered(league.fdCode) ? `fd~${league.fdCode}` : `tsdb~${league.tsdbId}`;
}

/** Provider-scoped ids: "fd~123", "tsdb~456", "espn~eng.1~789" */
export function encodeEntityId(provider: string, ...parts: (string | number)[]): string {
  return [provider, ...parts].map(String).map(encodeURIComponent).join('~');
}

export function decodeEntityId(id: string): { provider: string; parts: string[] } | null {
  const segs = id.split('~').map(decodeURIComponent);
  if (segs.length < 2) return null;
  return { provider: segs[0], parts: segs.slice(1) };
}

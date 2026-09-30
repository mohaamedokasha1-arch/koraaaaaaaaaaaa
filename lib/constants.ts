/**
 * Featured competitions supported by the primary provider's free plan,
 * with cross-provider mapping used to dedupe & fall back.
 */

export interface FeaturedLeague {
  /** football-data.org code */
  fdCode: string;
  /** TheSportsDB league id */
  tsdbId: string;
  /** ESPN slug e.g. eng.1 */
  espnSlug: string;
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

export function featuredByFdCode(code: string): FeaturedLeague | undefined {
  return FEATURED_LEAGUES.find((l) => l.fdCode === code);
}

export function featuredByTsdbId(id: string): FeaturedLeague | undefined {
  return FEATURED_LEAGUES.find((l) => l.tsdbId === id);
}

export function featuredByEspnSlug(slug: string): FeaturedLeague | undefined {
  return FEATURED_LEAGUES.find((l) => l.espnSlug === slug);
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

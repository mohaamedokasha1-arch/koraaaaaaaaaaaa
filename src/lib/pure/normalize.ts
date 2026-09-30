/**
 * Arabic/Latin text normalisation used by in-site search.
 *
 * Goals (spec §19): tolerate hamza spelling variants, taa marbuta, tatweel and
 * diacritics, Arabic-Indic digits, and let users find clubs by their common
 * Arabic name (الأهلي) as well as the provider's Latin spelling (Al Ahly).
 * Pure functions — no I/O, so they are unit-tested directly.
 */

const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const ARABIC_INDIC = /[\u0660-\u0669\u06F0-\u06F9]/g;

function mapDigits(ch: string): string {
  const code = ch.charCodeAt(0);
  if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
  return String(code - 0x06f0);
}

export function normalizeText(input: string): string {
  if (!input) return '';
  return input
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .replace(ARABIC_INDIC, mapDigits)
    .replace(/[أإآٱﺃﺇﺁ]/g, 'ا')
    .replace(/[ىئي]/g, 'ي')
    .replace(/[ةه]/g, 'ه')
    .replace(/[ؤو]/g, 'و')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Common Arabic club/competition names → the Latin string providers index.
 * Kept deliberately curated (real clubs only) and used for query expansion,
 * never for renaming displayed data.
 */
export const SEARCH_ALIASES: Record<string, string[]> = {
  'الاهلي': ['Al Ahly', 'Al Ahly SC'],
  'الزمالك': ['Zamalek', 'Zamalek SC'],
  'بيراميدز': ['Pyramids FC'],
  'المصري': ['Al Masry', 'Al Masry Club'],
  'الاسماعيلي': ['Ismaily', 'Ismaily SC'],
  'سموحه': ['Smouha', 'Smouha Sporting Club'],
  'الاتحاد السكندري': ['Ittihad El Iskandary', 'Al Ittihad Alexandria'],
  'انبي': ['ENPPI'],
  'فيوتشر': ['Future FC', 'Modern Future'],
  'سيراميكا كليوباترا': ['Ceramica Cleopatra'],
  'فاركو': ['Pharco FC'],
  'البنك الاهلي': ['National Bank SC', 'National Bank of Egypt'],
  'غزل المحله': ['Ghazl Al Mehalla', 'Ghazl El Mahalla'],
  'الجونه': ['El Gouna'],
  'طلائع الجيش': ['Tala\'ea El Gaish'],
  'زد': ['ZED FC'],
  'بتروجت': ['PetroJet'],
  'حرس الحدود': ['Haras El Hodood', 'Haras El Hodoud'],
  'المقاولون العرب': ['Arab Contractors', 'El Mokawloon'],
  'ريال مدريد': ['Real Madrid'],
  'برشلونه': ['Barcelona', 'FC Barcelona'],
  'ليفربول': ['Liverpool'],
  'مانشستر سيتي': ['Manchester City'],
  'مانشستر يونايتد': ['Manchester United'],
  'ارسنال': ['Arsenal'],
  'تشيلسي': ['Chelsea'],
  'توتنهام': ['Tottenham', 'Tottenham Hotspur'],
  'نيوكاسل': ['Newcastle', 'Newcastle United'],
  'بايرن ميونخ': ['Bayern', 'Bayern Munich', 'FC Bayern Munchen'],
  'دورتموند': ['Dortmund', 'Borussia Dortmund'],
  'يوفنتوس': ['Juventus'],
  'ميلان': ['AC Milan', 'Milan'],
  'انتر ميلان': ['Inter', 'Inter Milan'],
  'باريس سان جيرمان': ['Paris Saint-Germain', 'PSG'],
  'الهلال': ['Al Hilal'],
  'النصر': ['Al Nassr'],
  'الاتحاد': ['Al Ittihad'],
  'الترجي': ['Esperance', 'ES Tunis'],
  'الاهلي المصري': ['Al Ahly'],
};

/** Provider query strings worth trying for a user-supplied (possibly Arabic) query. */
export function expandQuery(raw: string): string[] {
  const q = raw.trim();
  if (q.length < 2) return [];
  const normalized = normalizeText(q);
  const candidates = new Set<string>([q]);

  for (const [arabic, latin] of Object.entries(SEARCH_ALIASES)) {
    if (normalized.includes(arabic) || arabic.includes(normalized)) {
      for (const name of latin) candidates.add(name);
      break;
    }
  }
  return Array.from(candidates).slice(0, 4);
}

/** Does a provider-side entity name plausibly match what the user typed? */
export function matchesQuery(entityName: string, rawQuery: string): boolean {
  const name = normalizeText(entityName);
  const q = normalizeText(rawQuery);
  if (!q || !name) return false;
  if (name.includes(q) || q.includes(name)) return true;
  for (const latin of expandQuery(rawQuery)) {
    const candidate = normalizeText(latin);
    if (candidate.length >= 3 && (name.includes(candidate) || candidate.includes(name))) return true;
  }
  return false;
}

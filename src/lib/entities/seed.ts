/**
 * Seed entities for the Football Knowledge Model.
 *
 * These are REAL clubs with REAL Arabic names. Two provenance rules:
 *   • Arabic names and Latin names already curated in this repository
 *     (`pure/normalize.ts` SEARCH_ALIASES) — reviewed in a previous round.
 *   • Additional Arabic aliases verified against **Wikidata** (CC0 / public
 *     domain) on 2026-10-01, e.g. Q223566 → «نادي القرن الأفريقي، المارد الأحمر،
 *     القلعة الحمراء، الأهلي المصري», Q8682 → «الريال، النادي الملكي»،
 *     Q7156 → «برشا، البارسا، البارصا». Verified values only; nothing invented.
 *
 * A club that is NOT here is not "missing": it is discovered at runtime from the
 * providers that already serve it, and registered with the same model. The seed
 * exists so search, slugs and aliases work before any provider answers.
 */

export interface SeedTeam {
  name: string;
  nameAr: string;
  /** Display country name (English, matching the provider wording). */
  country: string;
  /** Short code used in slugs to disambiguate same-name clubs (football convention). */
  countryCode: string;
  /** Route codes of the competitions the club plays in (only ones this app serves). */
  leagueCodes: string[];
  /** Extra names users actually type (Arabic nicknames, short forms). */
  aliases: string[];
  /** Wikidata item that the Arabic aliases were verified against (CC0). */
  wikidata?: string;
}

function team(
  name: string,
  nameAr: string,
  country: string,
  countryCode: string,
  leagueCodes: string[],
  aliases: string[] = [],
  wikidata?: string,
): SeedTeam {
  return { name, nameAr, country, countryCode, leagueCodes, aliases, wikidata };
}

export const SEED_TEAMS: SeedTeam[] = [
  // ── Egypt — Egyptian Premier League (the audience's home league) ──────────
  team('Al Ahly', 'الأهلي', 'Egypt', 'eg', ['EGY'],
    ['Al Ahly SC', 'Al Ahly Sporting Club', 'الاهلي المصري', 'النادي الأهلي', 'المارد الأحمر', 'القلعة الحمراء', 'نادي القرن الأفريقي'], 'Q223566'),
  team('Zamalek', 'الزمالك', 'Egypt', 'eg', ['EGY'], ['Zamalek SC', 'الزمالك المصري', 'القلعة البيضاء', 'الأبيض']),
  team('Pyramids FC', 'بيراميدز', 'Egypt', 'eg', ['EGY'], ['Pyramids', 'نادي بيراميدز']),
  team('Al Masry', 'المصري', 'Egypt', 'eg', ['EGY'], ['Al Masry Club', 'المصري البورسعيدي']),
  team('Ismaily', 'الإسماعيلي', 'Egypt', 'eg', ['EGY'], ['Ismaily SC', 'الاسماعيلي', 'الدراويش']),
  team('Smouha', 'سموحة', 'Egypt', 'eg', ['EGY'], ['Smouha Sporting Club', 'نادي سموحة']),
  team('Al Ittihad Alexandria', 'الاتحاد السكندري', 'Egypt', 'eg', ['EGY'], ['Ittihad El Iskandary', 'الاتحاد الاسكندري', 'زعيم الثغر']),
  team('ENPPI', 'إنبي', 'Egypt', 'eg', ['EGY'], ['انبي', 'نادي إنبي']),
  team('Modern Future', 'فيوتشر', 'Egypt', 'eg', ['EGY'], ['Future FC', 'مودرن فيوتشر']),
  team('Ceramica Cleopatra', 'سيراميكا كليوباترا', 'Egypt', 'eg', ['EGY'], ['Ceramica Cleopatra FC']),
  team('Pharco FC', 'فاركو', 'Egypt', 'eg', ['EGY'], ['Pharco', 'نادي فاركو']),
  team('National Bank of Egypt', 'البنك الأهلي', 'Egypt', 'eg', ['EGY'], ['National Bank SC', 'البنك الاهلي المصري']),
  team('Ghazl El Mahalla', 'غزل المحلة', 'Egypt', 'eg', ['EGY'], ['Ghazl Al Mehalla', 'غزل المحله']),
  team('El Gouna', 'الجونة', 'Egypt', 'eg', ['EGY'], ['El Gouna FC', 'نادي الجونة']),
  team("Tala'ea El Gaish", 'طلائع الجيش', 'Egypt', 'eg', ['EGY'], ['Talaea El Gaish', 'طلائع الجيش المصري']),
  team('ZED FC', 'زد', 'Egypt', 'eg', ['EGY'], ['ZED', 'نادي زد']),
  team('PetroJet', 'بتروجت', 'Egypt', 'eg', ['EGY'], ['Petrojet FC']),
  team('Haras El Hodoud', 'حرس الحدود', 'Egypt', 'eg', ['EGY'], ['Haras El Hodoud SC', 'حرس الحدود المصري']),
  team('Arab Contractors', 'المقاولون العرب', 'Egypt', 'eg', ['EGY'], ['El Mokawloon', 'المقاولون']),

  // ── England ──────────────────────────────────────────────────────────────
  team('Liverpool', 'ليفربول', 'England', 'eng', ['PL'], ['Liverpool FC', 'الريدز']),
  team('Manchester City', 'مانشستر سيتي', 'England', 'eng', ['PL'], ['Man City', 'مان سيتي']),
  team('Manchester United', 'مانشستر يونايتد', 'England', 'eng', ['PL'], ['Man United', 'مان يونايتد', 'الشياطين الحمر']),
  team('Arsenal', 'آرسنال', 'England', 'eng', ['PL'], ['ارسنال', 'المدفعجية']),
  team('Chelsea', 'تشيلسي', 'England', 'eng', ['PL'], ['Chelsea FC', 'البلوز']),
  team('Tottenham Hotspur', 'توتنهام', 'England', 'eng', ['PL'], ['Tottenham', 'توتنهام هوتسبير', 'السبيرز']),
  team('Newcastle United', 'نيوكاسل', 'England', 'eng', ['PL'], ['Newcastle', 'نيوكاسل يونايتد', 'الماجبايز']),

  // ── Spain ────────────────────────────────────────────────────────────────
  team('Real Madrid', 'ريال مدريد', 'Spain', 'esp', ['PD'],
    ['Real Madrid CF', 'ريال مدريد الإسباني', 'الريال', 'النادي الملكي', 'الميرينجي'], 'Q8682'),
  team('FC Barcelona', 'برشلونة', 'Spain', 'esp', ['PD'],
    ['Barcelona', 'برشلونه', 'البارسا', 'برشا', 'البارصا', 'البلوجرانا'], 'Q7156'),

  // ── Italy ────────────────────────────────────────────────────────────────
  team('Juventus', 'يوفنتوس', 'Italy', 'ita', ['SA'], ['Juventus FC', 'اليوفي', 'البيانكونيري']),
  team('AC Milan', 'ميلان', 'Italy', 'ita', ['SA'], ['Milan', 'إيه سي ميلان', 'الروسونيري']),
  team('Inter Milan', 'إنتر ميلان', 'Italy', 'ita', ['SA'], ['Inter', 'انتر', 'النيراتزوري']),

  // ── Germany ──────────────────────────────────────────────────────────────
  team('Bayern Munich', 'بايرن ميونخ', 'Germany', 'ger', ['BL1'], ['Bayern', 'FC Bayern Munchen', 'بايرن', 'البيافاري']),
  team('Borussia Dortmund', 'بوروسيا دورتموند', 'Germany', 'ger', ['BL1'], ['Dortmund', 'دورتموند']),

  // ── France ───────────────────────────────────────────────────────────────
  team('Paris Saint-Germain', 'باريس سان جيرمان', 'France', 'fra', ['FL1'], ['PSG', 'باريس سان جيرمان', 'بي إس جي']),

  // ── Arab world (entities only — no league page until a verified source serves one) ─
  team('Al Hilal', 'الهلال', 'Saudi Arabia', 'sa', [], ['Al Hilal SFC', 'الهلال السعودي', 'الزعيم']),
  team('Al Nassr', 'النصر', 'Saudi Arabia', 'sa', [], ['Al Nassr FC', 'النصر السعودي', 'العالمي']),
  team('Al Ittihad', 'الاتحاد', 'Saudi Arabia', 'sa', [], ['Al Ittihad Jeddah', 'الاتحاد السعودي', 'العميد']),
  team('Esperance de Tunis', 'الترجي', 'Tunisia', 'tn', [], ['Esperance', 'ES Tunis', 'الترجي التونسي', 'شيخ الأندية']),
];

/** Countries referenced by the seed, with their Arabic names for the UI. */
export const SEED_COUNTRIES: { name: string; nameAr: string; code: string }[] = [
  { name: 'Egypt', nameAr: 'مصر', code: 'eg' },
  { name: 'Saudi Arabia', nameAr: 'السعودية', code: 'sa' },
  { name: 'United Arab Emirates', nameAr: 'الإمارات', code: 'ae' },
  { name: 'Qatar', nameAr: 'قطر', code: 'qa' },
  { name: 'Morocco', nameAr: 'المغرب', code: 'ma' },
  { name: 'Algeria', nameAr: 'الجزائر', code: 'dz' },
  { name: 'Tunisia', nameAr: 'تونس', code: 'tn' },
  { name: 'Iraq', nameAr: 'العراق', code: 'iq' },
  { name: 'Jordan', nameAr: 'الأردن', code: 'jo' },
  { name: 'England', nameAr: 'إنجلترا', code: 'eng' },
  { name: 'Spain', nameAr: 'إسبانيا', code: 'esp' },
  { name: 'Italy', nameAr: 'إيطاليا', code: 'ita' },
  { name: 'Germany', nameAr: 'ألمانيا', code: 'ger' },
  { name: 'France', nameAr: 'فرنسا', code: 'fra' },
  { name: 'Netherlands', nameAr: 'هولندا', code: 'ned' },
  { name: 'Portugal', nameAr: 'البرتغال', code: 'por' },
  { name: 'Brazil', nameAr: 'البرازيل', code: 'bra' },
];

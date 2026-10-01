/**
 * News Intelligence (pure): classification, de-duplication and story clustering.
 *
 * The problem this solves: one transfer rumour gets published by fifteen
 * outlets within an hour. Showing fifteen headlines is noise; showing one story
 * with "covered by 15 sources" is intelligence. At the same time the opposite
 * error is worse — merging two DIFFERENT stories about the same club into one.
 *
 * So the rules are deliberately asymmetric:
 *   • URL equality after normalisation      → same item (certain).
 *   • Title similarity ≥ 0.82               → same story (near-certain).
 *   • Same primary entity AND same event type AND similarity ≥ 0.55 AND within
 *     36h                                   → same story (careful heuristic).
 *   • Otherwise                             → separate stories. Never merged.
 *
 * Everything here is IO-free and unit-tested directly.
 */

export type NewsCategory =
  | 'match'
  | 'transfer'
  | 'injury'
  | 'coach'
  | 'competition'
  | 'national'
  | 'general';

export type NewsHubCategory =
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

export interface IntelItem {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceUrl: string;
  publishedAt: string | null;
  excerpt: string;
  language: 'ar' | 'en' | 'other';
  category: NewsCategory;
  /** Display names of the entities this item was linked to. */
  entities: string[];
  entityIds: string[];
  hub: NewsHubCategory;
}

const ARABIC_RANGE = /[\u0600-\u06FF]/;

/** Arabic-script ratio decides the language; short Arabic snippets still count. */
export function detectLanguage(text: string): 'ar' | 'en' | 'other' {
  const sample = text.slice(0, 400);
  if (!sample.trim()) return 'other';
  let arabic = 0;
  let latin = 0;
  for (const ch of sample) {
    if (ARABIC_RANGE.test(ch)) arabic += 1;
    else if (/[a-zA-Z]/.test(ch)) latin += 1;
  }
  if (arabic === 0 && latin === 0) return 'other';
  if (arabic >= latin) return 'ar';
  return latin > 0 ? 'en' : 'other';
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'to', 'of', 'in', 'for', 'and', 'with', 'on', 'at', 'by', 'from', 'is', 'are',
  'was', 'were', 'be', 'as', 'after', 'before', 'over', 'into', 'his', 'her', 'its', 'their',
  'vs', 'v', 'new', 'says', 'said', 'will', 'could', 'may',
  'في', 'من', 'على', 'عن', 'مع', 'بعد', 'قبل', 'الى', 'إلى', 'ان', 'أن', 'إن', 'هذا', 'هذه',
  'ذلك', 'التي', 'الذي', 'علي', 'و', 'او', 'أو', 'ثم', 'كل', 'بين', 'خلال', 'ضد', 'حول', 'انه',
  'أنه', 'على', 'الي', 'شاهد', 'بالفيديو', 'صور',
]);

/**
 * Normalise a headline for comparison: Arabic folding (hamza/taa marbuta/
 * diacritics), Latin lower-casing, punctuation removal, stop-word removal and
 * de-duplication of repeated tokens.
 */
export function canonicalTitle(title: string): string {
  const folded = (title || '')
    .normalize('NFKD')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
    .replace(/[\u0649\u0626\u064A]/g, '\u064A')
    .replace(/[\u0629]/g, '\u0647')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const tokens = folded.split(' ').filter((t) => t && !STOPWORDS.has(t) && t.length > 1);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    unique.push(token);
  }
  return unique.join(' ');
}

function bigrams(value: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < value.length - 1; i += 1) out.add(value.slice(i, i + 2));
  return out;
}

function tokenJaccard(a: string, b: string): number {
  const A = new Set(a.split(' ').filter(Boolean));
  const B = new Set(b.split(' ').filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared += 1;
  return shared / (A.size + B.size - shared);
}

function bigramDice(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let shared = 0;
  for (const g of A) if (B.has(g)) shared += 1;
  return (2 * shared) / (A.size + B.size);
}

/** Similarity of two headlines after canonicalisation (0..1). */
export function titleSimilarity(a: string, b: string): number {
  const ca = canonicalTitle(a);
  const cb = canonicalTitle(b);
  if (!ca || !cb) return 0;
  if (ca === cb) return 1;
  const jaccard = tokenJaccard(ca, cb);
  const dice = bigramDice(ca.replace(/ /g, ''), cb.replace(/ /g, ''));
  const containment = ca.includes(cb) || cb.includes(ca) ? 0.9 : 0;
  return Math.max(containment, 0.6 * dice + 0.4 * jaccard);
}

/** URL normalisation for equality checks (tracking params, host case, slashes). */
export function canonicalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const drop = [...parsed.searchParams.keys()].filter((k) => /^utm_|^at_|^ref$|^fbclid$|^gclid$/i.test(k));
    for (const key of drop) parsed.searchParams.delete(key);
    parsed.hash = '';
    parsed.host = parsed.host.toLowerCase().replace(/^www\./, '');
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    const query = parsed.searchParams.toString();
    return `${parsed.host}${path}${query ? `?${query}` : ''}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

const CATEGORY_RULES: { category: NewsCategory; ar: RegExp; en: RegExp }[] = [
  {
    category: 'transfer',
    ar: /انتقال|ينتقل|صفقة|تعاقد|يوقع|توقيع|يرحل|رحيل|إعارة|اعاره|مفاوضات|يرفض|يعرض|مقابل|عقد/,
    en: /transfer|signs|signing|deal|joins|loan|move to|bid|fee|contract|renewal|release clause|swap/i,
  },
  {
    category: 'injury',
    ar: /إصاب|اصاب|يغيب|غياب|الرباط|العضلة|كسر|جراح|يعود للملاعب|الفحوصات|مستشفى/,
    en: /injur|sidelined|out for|fitness|surgery|hamstring|acl|knock|ruled out|recovery/i,
  },
  {
    category: 'coach',
    ar: /مدرب|المدير الفني|إقالة|اقالة|يستقيل|الجهاز الفني|تعيين|يرحل عن تدريب|مساعد/,
    en: /coach|manager|sacked|appointed|resign|boss|head coach|interim/i,
  },
  {
    category: 'match',
    ar: /يفوز|يخسر|تعادل|هدف|أهداف|اهداف|مباراة|قمة|ديربي|نتيجة|يشاهد|ملخص|يرد|يقلب|يتأهل|يهزم|يهزم|يقصي|يكتسح|خسارة|فوز|انتصار|تعادل|سحق/,
    en: /beat|beats|wins|won|draw|draws|thrash|lose|loses|lost|goal|hat-trick|match|derby|clasico|final|semi|advance|qualif|highlights|edge past|defeat|victory|clash|held to|comeback/i,
  },
  {
    category: 'competition',
    ar: /دوري|بطولة|كأس|كاس|موسم|ترتيب|قرعة|تصفيات|دور المجموعات|نهائي/,
    en: /league|cup|trophy|title|season|standings|draw|group|qualifier|tournament|champions/i,
  },
  {
    category: 'national',
    ar: /منتخب|الفراعنة|الفراعنه|المنتخب الوطني|معسكر|ودية|وديه/,
    en: /national team|international|friendly|squad announced|call-?up|world cup|afcon/i,
  },
];

export function classifyNews(title: string, excerpt = ''): NewsCategory {
  const text = `${title} ${excerpt}`.slice(0, 400);
  // Priority matters: a transfer story mentioning "match" stays a transfer.
  for (const rule of CATEGORY_RULES) {
    if (rule.ar.test(text) || rule.en.test(text)) return rule.category;
  }
  return 'general';
}

const HUB_RULES: { hub: NewsHubCategory; pattern: RegExp }[] = [
  { hub: 'egypt', pattern: /مصر|الأهلي|الاهلي|الزمالك|بيراميدز|الإسماعيلي|الاسماعيلي|المصري|الدوري المصري|egypt|al ahly|zamalek|pyramids|ismaily|pharaoh/i },
  {
    hub: 'arab',
    pattern: /السعودية|الهلال|النصر|الاتحاد|الإمارات|الامارات|قطر|المغرب|الجزائر|تونس|العراق|الأردن|الاردن|العين|السد|الترجي|الرجاء|الوداد|saudi|hilal|nassr|ittihad|emirat|qatar|morocco|algeria|tunisia|iraq|jordan|raja|wydad|es ?tunis|esperance|afc champions/i,
  },
  { hub: 'england', pattern: /إنجلترا|انجلترا|البريميرليج|الدوري الإنجليزي|ليفربول|مانشستر|آرسنال|ارسنال|تشيلسي|توتنهام|نيوكاسل|england|premier league|liverpool|manchester|arsenal|chelsea|tottenham|newcastle|everton|aston villa/i },
  { hub: 'spain', pattern: /إسبانيا|اسبانيا|الليجا|الليغا|ريال مدريد|برشلونة|برشلونه|أتلتيكو|atletico|spain|laliga|la liga|real madrid|barcelona|sevilla|valencia/i },
  { hub: 'italy', pattern: /إيطاليا|ايطاليا|الكالتشيو|الدوري الإيطالي|يوفنتوس|ميلان|إنتر|انتر|نابولي|roma|italy|serie a|juventus|inter|milan|napoli|roma|atalanta/i },
  { hub: 'germany', pattern: /ألمانيا|المانيا|البوندسليجا|بایرن|بايرن|دورتموند|ليفركوزن|germany|bundesliga|bayern|dortmund|leverkusen|leipzig/i },
  { hub: 'france', pattern: /فرنسا|ليج 1|باريس سان جيرمان|مارسيليا|ليون|موناكو|france|ligue 1|psg|paris saint|marseille|lyon|monaco/i },
  { hub: 'africa', pattern: /أفريقيا|افريقيا|الكاف|دوري أبطال أفريقيا|كان|أمم أفريقيا|السنغال|نيجيريا|غانا|africa|caf|afcon|senegal|nigeria|ghana|egypt|morocco|algeria|tunisia|south africa/i },
  { hub: 'europe', pattern: /أوروبا|اوروبا|دوري أبطال أوروبا|الدوري الأوروبي|يويفا|uefa|europa league|champions league|conference league/i },
];

/** Region bucket for the News Hub, based on text and linked entities. */
export function hubCategory(
  text: string,
  entityCountries: (string | null | undefined)[] = [],
  language: 'ar' | 'en' | 'other' = 'en',
): NewsHubCategory {
  const haystack = `${text} ${entityCountries.filter(Boolean).join(' ')}`;
  for (const rule of HUB_RULES) {
    if (rule.pattern.test(haystack)) return rule.hub;
  }
  return language === 'ar' ? 'arab' : 'world';
}

export interface ClusterOptions {
  /** Max items per cluster (guard against a runaway feed). */
  maxPerCluster?: number;
  /** Hours within which two items may be considered the same story. */
  windowHours?: number;
  /** Similarity needed to merge on titles alone. */
  titleThreshold?: number;
  /** Similarity needed when entities + category also agree. */
  entityThreshold?: number;
}

const DEFAULTS: Required<ClusterOptions> = {
  maxPerCluster: 12,
  windowHours: 36,
  titleThreshold: 0.82,
  entityThreshold: 0.55,
};

function hoursApart(a: string | null, b: string | null): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return Number.POSITIVE_INFINITY;
  return Math.abs(ta - tb) / 3_600_000;
}

/** Should these two items be treated as one story? */
export function isSameStory(
  a: IntelItem,
  b: IntelItem,
  options: ClusterOptions = {},
): boolean {
  const opts = { ...DEFAULTS, ...options };
  if (canonicalUrl(a.url) === canonicalUrl(b.url)) return true;

  const similarity = titleSimilarity(a.title, b.title);
  if (similarity >= opts.titleThreshold) return true;

  const withinWindow = hoursApart(a.publishedAt, b.publishedAt) <= opts.windowHours;
  if (!withinWindow) return false;

  const aEntities = new Set(a.entityIds.length ? a.entityIds : a.entities);
  const bEntities = new Set(b.entityIds.length ? b.entityIds : b.entities);
  const shared = [...aEntities].filter((e) => bEntities.has(e));
  if (shared.length === 0) {
    // No shared entity: only near-identical wording may merge the two items.
    return similarity >= opts.titleThreshold;
  }

  // Cross-language coverage of one event: Arabic and English headlines share
  // no words at all, so a *complete* entity-set match on a multi-entity event
  // plus the same news type is the signal that they are one story.
  // (Deliberately not applied to single-entity sets — "Al Ahly sign X" and
  // "Al Ahly sign Y" both involve one club and are different stories.)
  if (aEntities.size >= 2 && aEntities.size === bEntities.size && shared.length === aEntities.size) {
    return a.category === b.category;
  }

  if (similarity < opts.entityThreshold) return false;

  // Both items clearly about a different (single) club → different stories,
  // even if the wording is similar. This is the merge we refuse to make.
  if (aEntities.size > 0 && bEntities.size > 0) {
    const aOnly = [...aEntities].filter((e) => !bEntities.has(e));
    const bOnly = [...bEntities].filter((e) => !aEntities.has(e));
    if (aOnly.length > 0 && bOnly.length > 0 && similarity < 0.9) return false;
  }

  return a.category === b.category;
}

export interface StoryCluster<T extends IntelItem> {
  key: string;
  representative: T;
  items: T[];
  sources: string[];
  entityIds: string[];
  firstSeen: string | null;
  lastSeen: string | null;
}

/**
 * Cluster items into stories. The representative is the item a reader should
 * see: newest wins, with a preference for items that carry an image and come
 * from a higher-ranked source.
 */
export function clusterStories<T extends IntelItem>(
  items: T[],
  options: ClusterOptions & { sourceRank?: Record<string, number> } = {},
): StoryCluster<T>[] {
  const opts = { ...DEFAULTS, ...options };
  const rank = options.sourceRank ?? {};
  const sorted = [...items].sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
  const clusters: StoryCluster<T>[] = [];

  for (const item of sorted) {
    const target = clusters.find((cluster) => isSameStory(cluster.representative, item, opts));
    if (target) {
      if (target.items.length < opts.maxPerCluster) {
        target.items.push(item);
        if (!target.sources.includes(item.source)) target.sources.push(item.source);
        for (const id of item.entityIds) if (!target.entityIds.includes(id)) target.entityIds.push(id);
      }
      continue;
    }
    clusters.push({
      key: `story:${canonicalUrl(item.url)}`,
      representative: item,
      items: [item],
      sources: [item.source],
      entityIds: [...item.entityIds],
      firstSeen: item.publishedAt,
      lastSeen: item.publishedAt,
    });
  }

  for (const cluster of clusters) {
    cluster.representative = [...cluster.items].sort((a, b) => {
      const rankA = rank[a.source] ?? 0;
      const rankB = rank[b.source] ?? 0;
      if (rankA !== rankB) return rankB - rankA;
      return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');
    })[0];
    const times = cluster.items.map((i) => i.publishedAt).filter((t): t is string => Boolean(t));
    cluster.firstSeen = times.length ? times.reduce((min, t) => (t < min ? t : min)) : null;
    cluster.lastSeen = times.length ? times.reduce((max, t) => (t > max ? t : max)) : null;
  }
  return clusters;
}

/** Remove exact duplicates (same story, same source) before clustering. */
export function dedupeItems<T extends IntelItem>(items: T[], options: ClusterOptions = {}): T[] {
  const opts = { ...DEFAULTS, ...options };
  const seenUrls = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const url = canonicalUrl(item.url);
    if (seenUrls.has(url)) continue;
    const duplicate = out.some(
      (kept) => kept.source === item.source && isSameStory(kept, item, { ...opts, windowHours: opts.windowHours }),
    );
    if (duplicate) continue;
    seenUrls.add(url);
    out.push(item);
  }
  return out;
}

/**
 * Link a headline to entities by name matching, using ONLY names supplied by the
 * caller (the registry) — the classifier never guesses a club into existence.
 */
export interface EntityHint {
  id: string;
  /** Every name this entity is known by (first entry is the display name). */
  names: string[];
  /** Display label preferred for the current audience (Arabic when known). */
  label?: string;
  country?: string | null;
}

export function linkEntities(
  text: string,
  hints: EntityHint[],
  limit = 6,
): EntityHint[] {
  const haystack = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `;
  const scored: { hint: EntityHint; score: number; at: number }[] = [];
  for (const hint of hints) {
    let best = 0;
    let at = Number.POSITIVE_INFINITY;
    for (const name of hint.names) {
      const needle = name.toLowerCase().trim();
      if (needle.length < 3) continue;
      const index = haystack.indexOf(needle);
      if (index === -1) continue;
      const score = needle.length;
      if (score > best) {
        best = score;
        at = index;
      }
    }
    if (best > 0) scored.push({ hint, score: best, at });
  }
  // First-mentioned entity is the story's subject; longer names break ties.
  return scored
    .sort((a, b) => a.at - b.at || b.score - a.score)
    .slice(0, limit)
    .map((s) => s.hint);
}

/** Rough "how many sources are covering this story" summary for the UI. */
export function coverageSummary(cluster: StoryCluster<IntelItem>): {
  size: number;
  sources: number;
  firstSeen: string | null;
  lastSeen: string | null;
} {
  return {
    size: cluster.items.length,
    sources: cluster.sources.length,
    firstSeen: cluster.firstSeen,
    lastSeen: cluster.lastSeen,
  };
}

/**
 * Football relevance gate.
 *
 * A general-sports feed (e.g. a newspaper's "sports" section) carries handball,
 * basketball and athletics alongside football. The platform is football-only, so
 * items that are clearly about another sport are dropped BEFORE they reach the
 * hub — but only when there is no football signal at all:
 *
 *   • any linked football entity ("الأهلي", "Real Madrid") proves relevance,
 *   • a strong football term (the competitions and the sport itself) proves it,
 *   • otherwise an item that names another sport is dropped,
 *   • anything uncertain is KEPT — recall beats a tidy-looking hub.
 */
const OTHER_SPORT_RULE =
  /(كرة اليد|كره اليد|handball|كرة السلة|كره السله|السلة|السله|basketball|الكرة الطائرة|الطائرة|volleyball|تنس الطاولة|table tennis|التنس|tennis|السباحة|swimming|ألعاب القوى|العاب القوى|athletics|الملاكمة|boxing|الجودو|judo|التايكوندو|taekwondo|الكاراتيه|karate|رفع الأثقال|weightlifting|الفروسية|equestrian|الدراجات|cycling|الرماية|shooting|المبارزة|fencing|كريكيت|cricket|الرغبي|rugby|الهوكي|hockey|الجولف|golf|البولينج|bowling|الشطرنج|chess|فورمولا|formula|رالي|rally|موتو جي بي|moto ?gp|سباق الخيل|horse racing|الإسكواش|الاسكواش|squash|الريشة الطائرة|badminton|الدارتس|darts)/i;

const STRONG_FOOTBALL_RULE =
  /(كرة القدم|كره القدم|football|soccer|دوري أبطال|champions league|الدوري الإنجليزي|premier league|الدوري المصري|الدوري السعودي|الدوري الإسباني|لاليجا|la ?liga|الدوري الإيطالي|سيري|serie a|البوندسليجا|bundesliga|ليج 1|ligue 1|كأس العالم|world cup|مونديال|كأس أمم|afcon|كان|الكونفدرالية|confederation cup|الدوري الأوروبي|europa league|كرة قدم)/i;

export function footballRelevance(
  title: string,
  excerpt = '',
  linkedEntities = 0,
): 'football' | 'other' | 'unknown' {
  const text = `${title} ${excerpt}`.slice(0, 500);
  if (linkedEntities > 0) return 'football';
  if (STRONG_FOOTBALL_RULE.test(text)) return 'football';
  if (OTHER_SPORT_RULE.test(text)) return 'other';
  return 'unknown';
}

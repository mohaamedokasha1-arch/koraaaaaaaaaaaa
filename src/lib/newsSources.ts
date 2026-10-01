import 'server-only';
import type { FeedConfig } from '@/lib/pure/rss';
import { parseFeedConfig } from '@/lib/pure/rss';

/**
 * News Sources Directory.
 *
 * Every entry below was **tested with a real request on 2026-10-01** from this
 * environment and is documented with what was actually observed. This file is
 * the permanent anti-duplication reference: no source enters the ingestion
 * pipeline before it appears here with a verified status.
 *
 * Two hard rules learned the hard way in this round:
 *   • A live directory page does NOT mean a live feed — FilGoal still lists its
 *     RSS sections while every one of them answers "this service is no longer
 *     available". Testing the feed itself is mandatory.
 *   • Aggregation rights are the publisher's call. Verified-live sources stay
 *     OPT-IN: the operator enables them (NEWS_PRESETS / NEWS_FEEDS) once the
 *     terms for their use case are confirmed. Without that, nothing is fetched.
 */

export type SourceStatus =
  | 'verified-live' // tested live, terms clear enough to run
  | 'verified-opt-in' // tested live, display is allowed but licensing is the operator's decision
  | 'deferred' // works, but does not meet the quality bar (or licence unverified)
  | 'rejected'; // dead, broken or forbidden

export interface NewsSourceDescriptor {
  id: string;
  name: string;
  nameAr: string | null;
  feedUrl: string | null;
  homepage: string | null;
  language: 'ar' | 'en' | 'multi';
  country: string | null;
  coverage: string;
  linkHosts: string[];
  licence: string;
  displayPolicy: 'headline-excerpt-link' | 'headline-link';
  imagesAllowed: boolean;
  attributionRequired: boolean;
  updateCadence: string;
  status: SourceStatus;
  verifiedAt: string;
  /** What was actually requested and observed during verification. */
  verification: string;
  reason?: string;
}

export const NEWS_SOURCE_DIRECTORY: NewsSourceDescriptor[] = [
  {
    id: 'bbc-sport-football',
    name: 'BBC Sport',
    nameAr: 'بي بي سي سبورت',
    feedUrl: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
    homepage: 'https://www.bbc.co.uk/sport/football',
    language: 'en',
    country: 'United Kingdom',
    coverage: 'Global football: Premier League, European leagues, World Cup, AFCON, transfers.',
    linkHosts: ['bbc.co.uk', 'bbci.co.uk'],
    licence:
      'BBC Sport RSS terms: the "BBC Sport" credit must be displayed, the BBC logo may not be used, and business use requires BBC permission. Licence review is the operator\'s decision.',
    displayPolicy: 'headline-excerpt-link',
    imagesAllowed: false,
    attributionRequired: true,
    updateCadence: 'Continuous (30+ items observed within the last 24h).',
    status: 'verified-opt-in',
    verifiedAt: '2026-10-01',
    verification:
      'GET https://feeds.bbci.co.uk/sport/football/rss.xml returned 200 with 30+ football-only items dated 2026-09-30/10-01 (latest 2026-09-30T20:38Z). No image rights declared in the feed.',
  },
  {
    id: 'kingfut',
    name: 'KingFut',
    nameAr: 'كينج فوت',
    feedUrl: 'https://www.kingfut.com/feed/',
    homepage: 'https://www.kingfut.com',
    language: 'en',
    country: 'Egypt',
    coverage: 'Egyptian football, the national team, Egyptian players abroad, African competitions.',
    linkHosts: ['kingfut.com', 'feeds.feedburner.com'],
    licence:
      'Publisher RSS feed (WordPress). No separate syndication licence text published; the feed itself offers headline + excerpt + link. Operator must confirm terms before commercial use.',
    displayPolicy: 'headline-excerpt-link',
    imagesAllowed: false,
    attributionRequired: true,
    updateCadence: 'Several items per day (observed 2026-09-25 → 2026-09-29).',
    status: 'verified-opt-in',
    verifiedAt: '2026-10-01',
    verification:
      'GET https://www.kingfut.com/feed/ returned 200 (redirects to feeds.feedburner.com/KingFut) with Egyptian-football items dated 2026-09-29. Full article text is present in content:encoded and is deliberately NOT stored — only title + short excerpt.',
  },
  {
    id: 'youm7-sport',
    name: 'Youm7 Sport',
    nameAr: 'اليوم السابع — أخبار الرياضة',
    feedUrl: 'https://www.youm7.com/rss/SectionRss?SectionID=298',
    homepage: 'https://www.youm7.com/Section/أخبار-الرياضة/298/1',
    language: 'ar',
    country: 'Egypt',
    coverage:
      'Egyptian football first (Al Ahly, Zamalek, the national team, the Egyptian league) plus African club competitions; the section is a general sports desk.',
    linkHosts: ['youm7.com'],
    licence:
      'Publisher RSS feed with an embedded credit line ("المصدر: اليوم السابع"); the footer states all rights reserved. Displaying headline + excerpt + link is the feed\'s own publishing model, but commercial terms are the operator\'s decision.',
    displayPolicy: 'headline-excerpt-link',
    imagesAllowed: false,
    attributionRequired: true,
    updateCadence: 'Very high — dozens of items per day (sample showed items every 20–30 minutes).',
    status: 'verified-opt-in',
    verifiedAt: '2026-10-01',
    verification:
      'GET https://www.youm7.com/rss/SectionRss?SectionID=298 returned 200 with live Arabic items dated 2026-09-30/10-01 (معظمها كرة قدم مصرية: الأهلي، الزمالك، الدوري المصري، دوري أبطال أفريقيا). الأقسام الأخرى تعمل بنفس النمط (SectionRss?SectionID=…)، وقسم الرياضة عام فيحتاج مرشّح كرة القدم في خط الأنابيب لإسقاط رياضات أخرى.',
    reason:
      'أول مصدر عربي متحقَّق حيّ — يسدّ فجوة P0 عمليًا؛ يُبقي المشغّل قرار التفعيل، وخط الأنابيب يفلتر غير كرة القدم تلقائيًا.',
  },
  {
    id: 'guardian-football',
    name: 'The Guardian Football',
    nameAr: 'ذا غارديان — كرة القدم',
    feedUrl: 'https://www.theguardian.com/football/rss',
    homepage: 'https://www.theguardian.com/football',
    language: 'en',
    country: 'United Kingdom',
    coverage: 'Global football: Premier League, European football, women\'s game, transfers, analysis.',
    linkHosts: ['theguardian.com'],
    licence:
      'Guardian News & Media RSS feed — content copyright; RSS expressly offered with credit. Commercial reuse requires a licence; the platform shows headline + short excerpt + link with visible attribution.',
    displayPolicy: 'headline-excerpt-link',
    imagesAllowed: false,
    attributionRequired: true,
    updateCadence: 'High — several items per hour (live sample on 2026-10-01 00:24 GMT).',
    status: 'verified-opt-in',
    verifiedAt: '2026-10-01',
    verification:
      'GET https://www.theguardian.com/football/rss returned 200 with football-only items dated 2026-09-30/10-01 (Manchester City case, Women\'s Champions League, England). Feed carries full text and image credits; only title + 220-char excerpt are stored.',
  },
  {
    id: 'skysports-general',
    name: 'Sky Sports',
    nameAr: 'سكاي سبورتس',
    feedUrl: 'https://www.skysports.com/rss/12040',
    homepage: 'https://www.skysports.com',
    language: 'en',
    country: 'United Kingdom',
    coverage: 'Mixed sport (football, cricket, darts, F1, boxing…).',
    linkHosts: ['skysports.com'],
    licence: 'Copyright Sky. No aggregation licence published.',
    displayPolicy: 'headline-link',
    imagesAllowed: false,
    attributionRequired: true,
    updateCadence: 'Continuous.',
    status: 'deferred',
    verifiedAt: '2026-10-01',
    verification: 'GET returned 200 with live items — but the feed is general sport, not football.',
    reason: 'Fails the football-only quality bar: mixing cricket/darts/F1 into a football hub damages the product. A football-only feed was not verified.',
  },
  {
    id: 'skynewsarabia',
    name: 'Sky News Arabia',
    nameAr: 'سكاي نيوز عربية',
    feedUrl: 'https://www.skynewsarabia.com/rss',
    homepage: 'https://www.skynewsarabia.com',
    language: 'ar',
    country: 'United Arab Emirates',
    coverage: 'General news in Arabic with a sport section (/sport/…).',
    linkHosts: ['skynewsarabia.com'],
    licence: 'Copyright Sky News Arabia. No aggregation licence published.',
    displayPolicy: 'headline-link',
    imagesAllowed: false,
    attributionRequired: true,
    updateCadence: 'Continuous.',
    status: 'deferred',
    verifiedAt: '2026-10-01',
    verification:
      'GET /rss returned 200 with live Arabic items including /sport/ links; GET /rss/sport returned 404 (no football-only feed).',
    reason: 'Only a general-news feed exists, so football items cannot be isolated without mixing unrelated news.',
  },
  {
    id: 'filgoal',
    name: 'FilGoal',
    nameAr: 'في الجول',
    feedUrl: null,
    homepage: 'https://www.filgoal.com',
    language: 'ar',
    country: 'Egypt',
    coverage: 'Egyptian and Arab football (Arabic) — would have closed the biggest gap.',
    linkHosts: [],
    licence: 'n/a — feed retired by the publisher.',
    displayPolicy: 'headline-link',
    imagesAllowed: false,
    attributionRequired: true,
    updateCadence: 'n/a',
    status: 'rejected',
    verifiedAt: '2026-10-01',
    verification:
      'The RSS directory page /home/rss still lists section feeds, but every feed URL (e.g. /section/1/rss/مصر) answers "Sorry, this service is no longer available".',
    reason: 'Feed service discontinued by the publisher. A directory page is not a working feed.',
  },
  {
    id: 'yallakora',
    name: 'Yallakora',
    nameAr: 'يلاكورة',
    feedUrl: null,
    homepage: 'https://www.yallakora.com',
    language: 'ar',
    country: 'Egypt',
    coverage: 'Arab football (Arabic).',
    linkHosts: [],
    licence: 'n/a — no RSS endpoint available.',
    displayPolicy: 'headline-link',
    imagesAllowed: false,
    attributionRequired: true,
    updateCadence: 'n/a',
    status: 'rejected',
    verifiedAt: '2026-10-01',
    verification: 'GET /rss returned HTTP 404 (ASP.NET error page). No documented public API.',
    reason: 'No legal machine-readable access point; scraping is explicitly out of scope.',
  },
  {
    id: 'al-ain',
    name: 'Al Ain',
    nameAr: 'العين',
    feedUrl: null,
    homepage: 'https://al-ain.com',
    language: 'ar',
    country: 'United Arab Emirates',
    coverage: 'General news with a sport section.',
    linkHosts: [],
    licence: 'n/a — no RSS endpoint available.',
    displayPolicy: 'headline-link',
    imagesAllowed: false,
    attributionRequired: true,
    updateCadence: 'n/a',
    status: 'rejected',
    verifiedAt: '2026-10-01',
    verification: 'GET /rss returned HTTP 404.',
    reason: 'No verified machine-readable feed.',
  },
];

export function directoryEntry(id: string): NewsSourceDescriptor | undefined {
  return NEWS_SOURCE_DIRECTORY.find((entry) => entry.id === id);
}

/** Sources an operator may enable today (verified live, terms documented). */
export function enableableSources(): NewsSourceDescriptor[] {
  return NEWS_SOURCE_DIRECTORY.filter((entry) => entry.status === 'verified-opt-in' && entry.feedUrl);
}

/**
 * Resolve `NEWS_PRESETS` (comma-separated directory ids) into feed configs.
 * This is how an operator enables a verified source without hand-copying URLs,
 * and it automatically applies the verified host allow-list.
 */
export function presetFeeds(raw: string | undefined): FeedConfig[] {
  if (!raw) return [];
  const feeds: FeedConfig[] = [];
  for (const id of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const entry = directoryEntry(id);
    if (!entry || !entry.feedUrl) continue;
    if (entry.status === 'rejected' || entry.status === 'deferred') continue;
    feeds.push({
      name: entry.name,
      url: entry.feedUrl,
      homepage: entry.homepage ?? undefined,
      allowedHosts: entry.linkHosts.length > 0 ? entry.linkHosts : undefined,
      imagesAllowed: entry.imagesAllowed,
    });
  }
  return feeds;
}

/** Combine presets and manual feeds, de-duplicated by URL. */
export function resolveFeeds(presetsRaw: string | undefined, manualRaw: string | undefined): FeedConfig[] {
  const byUrl = new Map<string, FeedConfig>();
  for (const feed of presetFeeds(presetsRaw)) byUrl.set(feed.url, feed);
  for (const feed of parseFeedConfig(manualRaw)) byUrl.set(feed.url, feed);
  return [...byUrl.values()];
}

/** Public, secret-free summary for /api/health and diagnostics. */
export function sourceDirectorySummary() {
  return NEWS_SOURCE_DIRECTORY.map((entry) => ({
    id: entry.id,
    name: entry.name,
    language: entry.language,
    country: entry.country,
    status: entry.status,
    attributionRequired: entry.attributionRequired,
    imagesAllowed: entry.imagesAllowed,
    verifiedAt: entry.verifiedAt,
  }));
}

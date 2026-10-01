import type { Locale } from '../../../i18n/locales';
import type { DataResult, MatchStatus, UnifiedMatch } from '../../../lib/types';
import { cardCopy } from './copy.ts';
import { ogFontCovers } from './font-coverage.ts';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
export type CardVariant = 'result' | 'live' | 'fixture';
export interface ShareCardModel {
  version: 1; id: string; locale: Locale; variant: CardVariant; status: MatchStatus; statusLabel: string; title: string;
  home: { name: string; displayName: string; monogram: string; score: number | null };
  away: { name: string; displayName: string; monogram: string; score: number | null };
  league: string; kickoff: string; kickoffTime: string; snapshotTime: string; fetchedAt: string | null;
  source: string; stale: boolean; secondaryScore: string | null; scoreLabel: string;
}
const STATUS = new Set<MatchStatus>(['live', 'halftime', 'scheduled', 'finished', 'postponed', 'cancelled']);
const PROVIDER_NAMES: Record<string, string> = { fd: 'football-data.org', af: 'API-Football', espn: 'ESPN', tsdb: 'TheSportsDB', ofb: 'openfootball' };

/** Route-safe match IDs only, never an arbitrary URL/path passed to an upstream. */
export function validCardMatchId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 100 && (
    /^(?:fd|af|tsdb)~[1-9]\d{0,14}$/.test(value) ||
    /^espn~[a-z0-9]{1,20}(?:[.-][a-z0-9]{1,20}){0,3}~[1-9]\d{0,14}$/.test(value)
  );
}
export function cardText(value: unknown, max = 120): string {
  if (typeof value !== 'string') return '';
  return Array.from(value.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\ufffe\uffff]/g, '').replace(/\s+/g, ' ').trim()).slice(0, max).map(point => point.length === 1 && point.charCodeAt(0) >= 0xd800 && point.charCodeAt(0) <= 0xdfff ? '\ufffd' : point).join('');
}
export function clipCardText(text: string, max = 32): string {
  const parts = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (part) => part.segment);
  return parts.length <= max ? text : `${parts.slice(0, max - 1).join('')}…`;
}
export function textDirection(text: string): 'rtl' | 'ltr' {
  const first = text.match(/[\p{Script=Arabic}\p{Script=Latin}]/u)?.[0];
  return first && /\p{Script=Arabic}/u.test(first) ? 'rtl' : 'ltr';
}
export function monogram(text: string): string {
  if (textDirection(text) === 'rtl') return Array.from(new Intl.Segmenter('ar', { granularity: 'grapheme' }).segment(text.replace(/^ال(?=\p{Script=Arabic})/u, '')))[0]?.segment ?? '—';
  return text.split(/\s+/).slice(0, 2).map(word => Array.from(word)[0] ?? '').join('').toLocaleUpperCase('en').slice(0, 4) || '—';
}
function score(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 999 ? value : null;
}
function utcDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 50 || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
export function cardUtcStamp(value: unknown): string | null {
  const iso = utcDate(value);
  return iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : null;
}
function pair(home: number | null, away: number | null, locale: Locale) {
  return locale === 'ar' ? `${away ?? '—'} – ${home ?? '—'}` : `${home ?? '—'} – ${away ?? '—'}`;
}

/** A minimal public snapshot: no crests, events, preferences, personal IDs or inferred stats. */
export function buildShareCard(result: DataResult<UnifiedMatch>, locale: Locale): ShareCardModel | null {
  const match = result.data;
  if (!validCardMatchId(match.id) || !STATUS.has(match.status)) return null;
  const t = cardCopy(locale);
  const homeName = cardText(match.home.name), awayName = cardText(match.away.name);
  if (!homeName || !awayName) return null;
  const variant = match.status === 'finished' ? 'result' : match.status === 'live' || match.status === 'halftime' ? 'live' : 'fixture';
  const homeScore = variant === 'fixture' ? null : score(match.score.home);
  const awayScore = variant === 'fixture' ? null : score(match.score.away);
  const minute = typeof match.minute === 'number' && Number.isInteger(match.minute) && match.minute >= 0 && match.minute <= 200 ? match.minute : null;
  const fetchedAt = utcDate(result.fetchedAt);
  const htHome = score(match.score.htHome), htAway = score(match.score.htAway);
  const pensHome = score(match.score.pensHome), pensAway = score(match.score.pensAway);
  const secondary = variant === 'fixture' ? null : pensHome !== null && pensAway !== null ? `${t.penalties}: ${pair(pensHome, pensAway, locale)}` : htHome !== null && htAway !== null ? `${t.halfTime}: ${pair(htHome, htAway, locale)}` : null;
  const provider = result.source && !['cache', 'mixed', 'none'].includes(result.source) ? result.source : match.provider;
  const kickoffIso = utcDate(match.utcDate);
  return {
    version: 1, id: match.id, locale, variant, status: match.status,
    statusLabel: `${t.statuses[match.status]}${match.status === 'live' && minute !== null ? ` · ${minute}'` : ''}`,
    title: t.variants[variant],
    home: { name: homeName, displayName: clipCardText(homeName), monogram: monogram(homeName), score: homeScore },
    away: { name: awayName, displayName: clipCardText(awayName), monogram: monogram(awayName), score: awayScore },
    league: clipCardText(cardText(match.league.name), 66),
    kickoff: cardUtcStamp(match.utcDate) ?? t.unknown, kickoffTime: kickoffIso ? `${kickoffIso.slice(11, 16)} UTC` : '—',
    snapshotTime: cardUtcStamp(result.fetchedAt) ?? t.unknown, fetchedAt,
    source: (Object.hasOwn(PROVIDER_NAMES, provider) ? PROVIDER_NAMES[provider] : cardText(provider, 40)) || t.unknown,
    stale: result.stale === true, secondaryScore: secondary,
    scoreLabel: variant === 'fixture' ? t.statuses[match.status] : `${homeName} ${homeScore ?? '—'} – ${awayScore ?? '—'} ${awayName}`,
  };
}
export function matchCardPath(id: string, locale: Locale): string | null {
  return validCardMatchId(id) ? `/${locale}/matches/${encodeURIComponent(id)}` : null;
}
export function matchShareUrl(id: string, locale: Locale, origin: string): string | null {
  const path = matchCardPath(id, locale);
  if (!path) return null;
  try {
    const base = new URL(origin);
    if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) return null;
    return new URL(path, base.origin).href;
  } catch { return null; }
}
export function socialShareUrls(link: string) {
  // Only a validated match link from matchShareUrl is accepted by the UI.
  return { facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, x: `https://twitter.com/intent/tweet?url=${encodeURIComponent(link)}` };
}

/** Satori shapes Arabic glyphs but its word layout is LTR. Keep Latin runs intact. */
export function ogTextRuns(text: string): { rtl: boolean; parts: string[] } {
  const rtl = textDirection(text) === 'rtl';
  const tokens = text.match(/[^\s]*\p{Script=Arabic}[^\s]*|[^\p{Script=Arabic}]+/gu)?.map(value => value.trim()).filter(Boolean) ?? [text];
  if (rtl) return { rtl, parts: tokens };
  const parts: string[] = [];
  let arabic: string[] = [];
  const flush = () => { parts.push(...arabic.reverse()); arabic = []; };
  for (const token of tokens) {
    if (/\p{Script=Arabic}/u.test(token)) arabic.push(token);
    else { flush(); parts.push(token); }
  }
  flush();
  return { rtl, parts };
}

/** Never ask a remote font service to recover glyphs absent from local fonts. */
export function hasOgTypography(model: ShareCardModel): boolean {
  const t = cardCopy(model.locale);
  return [model.home.displayName, model.home.monogram, model.away.displayName, model.away.monogram,
    model.league, model.source, model.statusLabel, model.title, model.secondaryScore ?? '',
    model.kickoff, model.snapshotTime, t.home, t.away, t.source, t.updated, t.kickoff, t.stale,
  ].every(ogFontCovers);
}

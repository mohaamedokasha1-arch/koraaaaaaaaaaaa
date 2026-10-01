/**
 * Season model (pure). A season is an independent entity, so a team's 2025/26
 * table can never be confused with 2026/27, and history pages have a real id.
 *
 * Two shapes exist in world football and both are supported:
 *   • cross-year  → "2025-26" (European leagues, Egyptian Premier League)
 *   • calendar    → "2026"    (single-year leagues, e.g. many South American
 *                              and Nordic competitions)
 */

export type SeasonKind = 'cross-year' | 'calendar';

export interface SeasonRef {
  /** Stable id used in routes: `EGY:2025-26`. */
  id: string;
  leagueCode: string;
  label: string;
  kind: SeasonKind;
  /** ISO date (inclusive) */
  startDate: string;
  /** ISO date (inclusive) */
  endDate: string;
}

/**
 * Month (1-12) in which a cross-year competition rolls over. July is the safe
 * global default: June matches still belong to the finishing season, July/August
 * matches to the new one.
 */
export const CROSS_YEAR_START_MONTH = 7;

const LABEL_CROSS = /^\d{4}-\d{2}$/;
const LABEL_CALENDAR = /^\d{4}$/;

export function isSeasonLabel(label: string, kind?: SeasonKind): boolean {
  if (kind === 'cross-year') return LABEL_CROSS.test(label);
  if (kind === 'calendar') return LABEL_CALENDAR.test(label);
  return LABEL_CROSS.test(label) || LABEL_CALENDAR.test(label);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** "2025-26" → 2025 (the season's starting year). */
export function seasonStartYear(label: string): number {
  return Number(label.slice(0, 4));
}

export function crossYearLabel(startYear: number): string {
  return `${startYear}-${pad((startYear + 1) % 100)}`;
}

export function seasonRange(label: string, kind: SeasonKind): { startDate: string; endDate: string } {
  if (kind === 'calendar') {
    const year = Number(label.slice(0, 4));
    return { startDate: iso(year, 1, 1), endDate: iso(year, 12, 31) };
  }
  const startYear = seasonStartYear(label);
  return {
    startDate: iso(startYear, CROSS_YEAR_START_MONTH, 1),
    endDate: iso(startYear + 1, CROSS_YEAR_START_MONTH, 1),
  };
}

/** Which season does an ISO date belong to? */
export function seasonLabelFor(dateIso: string, kind: SeasonKind): string | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso);
  if (!parts) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  if (kind === 'calendar') return String(year);
  return month >= CROSS_YEAR_START_MONTH ? crossYearLabel(year) : crossYearLabel(year - 1);
}

export function seasonRef(
  leagueCode: string,
  label: string,
  kind: SeasonKind,
): SeasonRef | null {
  if (!isSeasonLabel(label, kind)) return null;
  const range = seasonRange(label, kind);
  return {
    id: `${leagueCode}:${label}`,
    leagueCode,
    label,
    kind,
    startDate: range.startDate,
    endDate: range.endDate,
  };
}

export function seasonForDate(
  leagueCode: string,
  dateIso: string,
  kind: SeasonKind,
): SeasonRef | null {
  const label = seasonLabelFor(dateIso, kind);
  return label ? seasonRef(leagueCode, label, kind) : null;
}

export function isInSeason(dateIso: string, season: SeasonRef): boolean {
  const day = dateIso.slice(0, 10);
  return day >= season.startDate.slice(0, 10) && day <= season.endDate.slice(0, 10);
}

/** Newest first: ["2025-26", "2024-25"] whatever the shape. */
export function sortSeasonLabels(labels: string[], direction: 'desc' | 'asc' = 'desc'): string[] {
  const sorted = [...labels].sort((a, b) =>
    a.slice(0, 4) === b.slice(0, 4) ? a.localeCompare(b) : Number(a.slice(0, 4)) - Number(b.slice(0, 4)),
  );
  return direction === 'desc' ? sorted.reverse() : sorted;
}

/**
 * Competition calendar shape. Only competitions verified to use one shape are
 * listed here; anything unknown is treated as cross-year (the global majority)
 * — this never invents data, it only decides which label a date maps to.
 */
const CALENDAR_LEAGUES = new Set<string>(['BSA']); // Brasileirão runs Feb–Dec

export function seasonKindFor(leagueCode: string): SeasonKind {
  return CALENDAR_LEAGUES.has(leagueCode) ? 'calendar' : 'cross-year';
}

/** "2024-25" → "2024/25" for display without touching stored values. */
export function seasonDisplayLabel(label: string): string {
  return LABEL_CROSS.test(label) ? label.replace('-', '/') : label;
}

/** Human label, localised. */
export function seasonText(label: string, locale: 'ar' | 'en'): string {
  const display = seasonDisplayLabel(label);
  return locale === 'ar' ? `موسم ${display}` : `${display} season`;
}

/** Ids for a set of labels — stable and route-safe. */
export function seasonIds(leagueCode: string, labels: string[]): string[] {
  return labels.map((l) => `${leagueCode}:${l}`);
}

import { intlLocale, type Locale } from '@/i18n/locales';
import { DEFAULT_TZ } from '@/lib/pure/time';

/**
 * All timestamps stay UTC in storage; these helpers only localise them for the
 * viewer. `tz` is the viewer's chosen zone (cookie, see lib/time.ts) and falls
 * back to the project default so every existing call site keeps working.
 */

export function formatKickoffTime(iso: string, locale: Locale, tz: string = DEFAULT_TZ): string {
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatMatchDate(iso: string, locale: Locale, tz: string = DEFAULT_TZ): string {
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatFullDate(iso: string, locale: Locale, tz: string = DEFAULT_TZ): string {
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDayGroup(date: string, locale: Locale, tz: string = DEFAULT_TZ): string {
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: tz,
    }).format(new Date(`${date}T12:00:00Z`));
  } catch {
    return date;
  }
}

/** Arabic-Indic numerals for ar, latin for en */
export function num(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { useGrouping: false }).format(value);
}

export function minuteLabel(minute: number | null, extra?: number | null): string {
  if (minute == null) return "'";
  return extra ? `${minute}+${extra}'` : `${minute}'`;
}

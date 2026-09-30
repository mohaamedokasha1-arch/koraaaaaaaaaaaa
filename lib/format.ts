import { intlLocale, type Locale } from '@/i18n/locales';

const TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Africa/Cairo';

export function formatKickoffTime(iso: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: TZ,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatMatchDate(iso: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: TZ,
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatFullDate(iso: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: TZ,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDayGroup(date: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: TZ,
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

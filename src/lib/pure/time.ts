/**
 * Timezone helpers — SHARED (client + server).
 *
 * Rule that never changes: every timestamp is STORED in UTC (providers give us
 * ISO UTC and we keep it that way). Only the presentation is localised, and the
 * viewer decides which zone that is — a match that kicks off at 20:00 in Cairo
 * must read 21:00 to a reader in Riyadh and 18:00 to one in London.
 *
 * The choice is a cookie, not a URL parameter, so it can never multiply indexable
 * URLs. Without the cookie the project default (`NEXT_PUBLIC_DEFAULT_TIMEZONE`,
 * Africa/Cairo) applies exactly as before.
 */

export const TIMEZONE_COOKIE = 'KORA_TZ';

export const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? 'Africa/Cairo';

/** Zones our audience actually asks for (short, human list — not the whole IANA set). */
export const TIMEZONE_CHOICES: { id: string; labelAr: string; labelEn: string }[] = [
  { id: 'Africa/Cairo', labelAr: 'القاهرة', labelEn: 'Cairo' },
  { id: 'Asia/Riyadh', labelAr: 'الرياض', labelEn: 'Riyadh' },
  { id: 'Asia/Dubai', labelAr: 'دبي', labelEn: 'Dubai' },
  { id: 'Asia/Qatar', labelAr: 'الدوحة', labelEn: 'Doha' },
  { id: 'Asia/Kuwait', labelAr: 'الكويت', labelEn: 'Kuwait' },
  { id: 'Africa/Casablanca', labelAr: 'الدار البيضاء', labelEn: 'Casablanca' },
  { id: 'Africa/Algiers', labelAr: 'الجزائر', labelEn: 'Algiers' },
  { id: 'Africa/Tunis', labelAr: 'تونس', labelEn: 'Tunis' },
  { id: 'Asia/Baghdad', labelAr: 'بغداد', labelEn: 'Baghdad' },
  { id: 'Asia/Amman', labelAr: 'عمّان', labelEn: 'Amman' },
  { id: 'Europe/London', labelAr: 'لندن', labelEn: 'London' },
  { id: 'Europe/Madrid', labelAr: 'مدريد', labelEn: 'Madrid' },
  { id: 'Europe/Rome', labelAr: 'روما', labelEn: 'Rome' },
  { id: 'Europe/Berlin', labelAr: 'برلين', labelEn: 'Berlin' },
  { id: 'Europe/Paris', labelAr: 'باريس', labelEn: 'Paris' },
  // Existing picker, expanded for the global audience (same cookie/validation).
  { id: 'Africa/Lagos', labelAr: 'لاغوس', labelEn: 'Lagos' },
  { id: 'Africa/Johannesburg', labelAr: 'جوهانسبرغ', labelEn: 'Johannesburg' },
  { id: 'Asia/Kolkata', labelAr: 'كولكاتا', labelEn: 'Kolkata' },
  { id: 'Asia/Singapore', labelAr: 'سنغافورة', labelEn: 'Singapore' },
  { id: 'Asia/Tokyo', labelAr: 'طوكيو', labelEn: 'Tokyo' },
  { id: 'Asia/Seoul', labelAr: 'سيول', labelEn: 'Seoul' },
  { id: 'America/New_York', labelAr: 'نيويورك', labelEn: 'New York' },
  { id: 'America/Los_Angeles', labelAr: 'لوس أنجلوس', labelEn: 'Los Angeles' },
  { id: 'America/Mexico_City', labelAr: 'مكسيكو سيتي', labelEn: 'Mexico City' },
  { id: 'America/Sao_Paulo', labelAr: 'ساو باولو', labelEn: 'São Paulo' },
  { id: 'Australia/Sydney', labelAr: 'سيدني', labelEn: 'Sydney' },
  { id: 'Pacific/Auckland', labelAr: 'أوكلاند', labelEn: 'Auckland' },
  { id: 'UTC', labelAr: 'التوقيت العالمي', labelEn: 'UTC' },
];

const KNOWN = new Set(TIMEZONE_CHOICES.map((choice) => choice.id));

export function isValidTimeZone(tz: string | null | undefined): boolean {
  if (!tz) return false;
  if (!KNOWN.has(tz)) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(cookieValue?: string | null): string {
  return isValidTimeZone(cookieValue) ? (cookieValue as string) : DEFAULT_TZ;
}

/**
 * UTC → viewer's zone for a calendar date string (yyyy-mm-dd). Used when grouping
 * matches by "day" so the groups follow the reader's midnight, not ours.
 */
export function localDayInZone(isoUtc: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(isoUtc));
  } catch {
    return isoUtc.slice(0, 10);
  }
}

export function zoneLabel(tz: string, locale: 'ar' | 'en'): string {
  const choice = TIMEZONE_CHOICES.find((entry) => entry.id === tz);
  if (choice) return locale === 'ar' ? choice.labelAr : choice.labelEn;
  return tz;
}

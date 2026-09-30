export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ar';

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'ar' || value === 'en';
}

export function localeDir(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'ar' ? 'en' : 'ar';
}

/** Intl locale tag used for date/number formatting. */
export function intlLocale(locale: Locale): string {
  return locale === 'ar' ? 'ar-EG' : 'en-GB';
}

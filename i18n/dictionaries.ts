import 'server-only';
import type { Locale } from './locales';
import ar from './ar.json';
import en from './en.json';

export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = {
  ar: ar as Dictionary,
  en,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? en;
}

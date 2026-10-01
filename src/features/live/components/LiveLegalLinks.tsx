import Link from 'next/link';
import type { Locale } from '@/i18n/locales';
import { getLiveCopy } from '../lib/copy.ts';

export function LiveLegalLinks({ locale }: { locale: Locale }) {
  const t = getLiveCopy(locale);
  return <nav aria-label={t.copyright} className="flex flex-wrap gap-x-5 gap-y-2 border-t border-navy-700 pt-5 text-xs text-slate-400"><Link href={`/${locale}/watch/copyright`} className="link-accent min-h-[32px]">{t.copyright}</Link><Link href={`/${locale}/watch/disclaimer`} className="link-accent min-h-[32px]">{t.disclaimer}</Link></nav>;
}

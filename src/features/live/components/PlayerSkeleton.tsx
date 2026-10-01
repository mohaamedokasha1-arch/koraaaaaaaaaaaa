import type { Locale } from '@/i18n/locales';
import { getLiveCopy } from '../lib/copy.ts';
import { LiveIcon } from './LiveIcon';

export function PlayerSkeleton({ locale }: { locale: Locale }) {
  return <div role="status" className="flex aspect-video items-center justify-center rounded-xl border border-navy-700 bg-navy-900 text-slate-300">
    <div className="flex animate-pulse items-center gap-3"><LiveIcon name="tv" /><span className="text-sm">{getLiveCopy(locale).loading}</span></div>
  </div>;
}

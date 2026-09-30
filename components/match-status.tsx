import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import type { MatchStatus, UnifiedMatch } from '@/lib/types';
import { formatKickoffTime, minuteLabel } from '@/lib/format';

export function StatusChip({
  match,
  locale,
  dict,
}: {
  match: UnifiedMatch;
  locale: Locale;
  dict: Dictionary;
}) {
  const m = dict.match;
  switch (match.status as MatchStatus) {
    case 'live':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-400">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulseDot" aria-hidden="true" />
          {m.statusLive}
        </span>
      );
    case 'halftime':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-400">
          {m.statusHT}
        </span>
      );
    case 'finished':
      return (
        <span className="inline-flex items-center rounded-md bg-navy-700/80 px-2 py-0.5 text-xs font-semibold text-slate-300">
          {m.statusFT}
        </span>
      );
    case 'postponed':
      return (
        <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
          {m.statusPostponed}
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300">
          {m.statusCancelled}
        </span>
      );
    default:
      return (
        <time dateTime={match.utcDate} className="text-xs font-semibold text-slate-300 tabular-nums">
          {formatKickoffTime(match.utcDate, locale)}
        </time>
      );
  }
}

export function MinuteLabel({ match }: { match: UnifiedMatch }) {
  if (match.status === 'live' && match.minute != null) {
    return (
      <span className="text-xs font-semibold text-red-400 tabular-nums">
        {minuteLabel(match.minute)}
      </span>
    );
  }
  return null;
}

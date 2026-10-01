import Link from 'next/link';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import type { UnifiedMatch } from '@/lib/types';
import { TeamLogo } from './team-logo';
import { StatusChip, MinuteLabel } from './match-status';
import { num } from '@/lib/format';

/** Status accent rail on the leading edge of every row. */
const RAIL: Record<UnifiedMatch['status'], string> = {
  live: 'bg-gradient-to-b from-red-400 to-red-600',
  halftime: 'bg-gradient-to-b from-amber-300 to-amber-500',
  finished: 'bg-gradient-to-b from-navy-400 to-navy-600',
  scheduled: 'bg-gradient-to-b from-navy-600/70 to-navy-700/40',
  postponed: 'bg-gradient-to-b from-amber-400/70 to-amber-600/50',
  cancelled: 'bg-gradient-to-b from-slate-500/70 to-slate-600/50',
};

/**
 * The money component — one professional, compact match row.
 * Full-surface link to the match details page.
 */
export function MatchCard({
  match,
  locale,
  dict,
  tz,
  showLeague = false,
}: {
  match: UnifiedMatch;
  locale: Locale;
  dict: Dictionary;
  tz?: string;
  showLeague?: boolean;
}) {
  const played = match.status !== 'scheduled' && match.status !== 'postponed' && match.status !== 'cancelled';
  const scheduled = match.status === 'scheduled';
  const isLive = match.status === 'live' || match.status === 'halftime';

  return (
    <Link
      href={`/${locale}/matches/${match.id}`}
      className={`card card-hover group block overflow-hidden px-3 sm:px-4 py-3 ${isLive ? 'card-live' : ''}`}
      aria-label={`${match.home.name} ${dict.common.versus} ${match.away.name}`}
    >
      {/* status rail */}
      <span aria-hidden="true" className={`absolute inset-y-0 start-0 w-[3px] ${RAIL[match.status]}`} />

      {showLeague && (
        <div className="mb-2 flex items-center gap-2 border-b border-navy-700/50 pb-2 text-xs text-slate-400">
          <TeamLogo src={match.league.emblem} alt={match.league.name} size={16} />
          <span className="truncate">{match.league.name}</span>
          {match.matchday != null && (
            <span className="ms-auto shrink-0 text-[11px] tabular-nums text-slate-500">
              {dict.match.matchday} {num(match.matchday, locale)}
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
        {/* Home */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 text-end">
          <span className="truncate text-sm font-semibold text-white group-hover:text-navy-200 transition-colors">
            {match.home.name}
          </span>
          <TeamLogo src={match.home.crest} alt={match.home.name} size={28} />
        </div>

        {/* Score / time */}
        <div className="flex w-[92px] sm:w-[112px] flex-col items-center justify-center gap-1">
          {played ? (
            <div className="score-pill text-lg sm:text-xl">
              <span>{match.score.home == null ? '–' : num(match.score.home, locale)}</span>
              <span className="text-slate-500">-</span>
              <span>{match.score.away == null ? '–' : num(match.score.away, locale)}</span>
            </div>
          ) : scheduled ? null : (
            <div className="text-base font-semibold text-slate-400">–</div>
          )}
          <StatusChip match={match} locale={locale} dict={dict} tz={tz} />
          <MinuteLabel match={match} />
        </div>

        {/* Away */}
        <div className="flex items-center justify-start gap-2 sm:gap-3 text-start">
          <TeamLogo src={match.away.crest} alt={match.away.name} size={28} />
          <span className="truncate text-sm font-semibold text-white group-hover:text-navy-200 transition-colors">
            {match.away.name}
          </span>
        </div>
      </div>
    </Link>
  );
}

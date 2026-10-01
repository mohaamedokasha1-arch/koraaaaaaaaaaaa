import Link from 'next/link';
import type { Locale } from '@/i18n/locales';
import { TeamLogo } from '@/components/team-logo';
import type { LiveMatch } from '../types/index.ts';
import { getLiveCopy } from '../lib/copy.ts';
import { Countdown } from './Countdown';
import { LiveIcon } from './LiveIcon';

export function LiveMatchCard({ match, sourceCount, locale }: { match: LiveMatch; sourceCount: number; locale: Locale }) {
  const t = getLiveCopy(locale);
  return <article className={`card overflow-hidden ${match.status === 'live' ? 'card-live' : ''}`}>
    <div className="flex items-center justify-between gap-2 border-b border-navy-700/60 px-4 py-3 text-xs">
      <span className="truncate text-slate-400">{match.competition.name}</span>
      <span className={`inline-flex shrink-0 items-center gap-1.5 font-semibold ${match.status === 'live' ? 'text-red-300' : 'text-slate-300'}`}>
        {match.status === 'live' && <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-red-400" aria-hidden="true" />}
        {match.status === 'live' ? t.live : match.status === 'ended' ? t.ended : t.statusScheduled}
      </span>
    </div>
    <div className="flex items-center justify-between gap-3 px-4 py-6">
      <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center"><TeamLogo src={match.home.crest} alt={match.home.name} size={40} /><h3 className="text-sm font-bold text-white">{match.home.name}</h3></div>
      <span className="text-xs font-bold tracking-widest text-slate-400" dir="ltr">VS</span>
      <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center"><TeamLogo src={match.away.crest} alt={match.away.name} size={40} /><h3 className="text-sm font-bold text-white">{match.away.name}</h3></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-700/60 px-4 py-3">
      <div className="text-xs text-slate-400">{match.status === 'scheduled' ? <Countdown match={match} locale={locale} compact /> : <span>{sourceCount} {t.sources}</span>}</div>
      <Link href={`/${locale}/watch/${encodeURIComponent(match.matchId)}`} className="btn-ghost !min-h-[40px] !px-3 !py-2 !text-xs"><LiveIcon name="play" className="h-3.5 w-3.5" />{match.status === 'ended' ? t.highlights : t.watch}</Link>
    </div>
  </article>;
}

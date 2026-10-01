'use client';

import type { Locale } from '@/i18n/locales';
import type { LiveMatch } from '../types/index.ts';
import { getLiveCopy } from '../lib/copy.ts';
import { matchCalendar } from '../lib/calendar.ts';
import { useLiveClock } from '../hooks/useLiveClock';
import { LiveIcon } from './LiveIcon';

export function Countdown({ match, locale, compact = false }: { match: LiveMatch; locale: Locale; compact?: boolean }) {
  const now = useLiveClock(null, 'countdown');
  const t = getLiveCopy(locale);
  const seconds = now === null ? null : Math.max(0, Math.floor((Date.parse(match.startsAt) - now) / 1000));
  const duration = seconds === null ? '––:––:––' : [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map((value) => String(value).padStart(2, '0')).join(':');
  function download() {
    const calendar = matchCalendar(match, window.location.href, new Date().toISOString());
    const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `match-${match.matchId}.ics`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className={compact ? 'text-xs text-slate-400' : 'card p-5 sm:p-6'}>
      {seconds === 0 ? <p className="text-sm text-amber-200">{t.kickoffReached}</p> : (
        <p className={`flex items-center gap-3 ${compact ? '' : 'text-sm text-slate-300'}`}>
          <span>{t.countdown}</span><span dir="ltr" className={`font-mono tabular-nums ${compact ? '' : 'text-2xl font-bold text-white'}`}>{duration}</span>
        </p>
      )}
      {!compact && <><p className="mt-3 text-xs text-slate-400">{t.scheduledBody}</p><button type="button" onClick={download} className="btn-ghost mt-4"><LiveIcon name="calendar" />{t.calendar}</button></>}
    </div>
  );
}

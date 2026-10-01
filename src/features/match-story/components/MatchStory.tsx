import type { Locale } from '@/i18n/locales';
import type { UnifiedMatch } from '@/lib/types';
import { storyCopy } from '../lib/copy';
import { buildStory, eventMinute } from '../lib/model';
import EventTimeline from './EventTimeline';

/** Server shell: the existing page/provider/cache remain the only data owner. */
export function MatchStory({ match, locale }: { match: UnifiedMatch; locale: Locale }) {
  const t = storyCopy(locale);
  const { events, highlights, omitted } = buildStory(match);
  const recent = highlights.slice(-6);
  return <section className="card min-w-0 overflow-hidden lg:col-span-3" aria-label={t.title} data-testid="match-story" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
    <div className="border-b border-navy-700 px-4 py-4 sm:px-5">
      <h2 className="text-base font-bold text-white">{t.title}</h2>
      <p className="mt-1 text-xs text-navy-100">{t.subtitle}</p>
      <p className="mt-3 text-xs leading-relaxed text-slate-400">{t.available}</p>
    </div>
    {match.status === 'finished' && <div className="border-b border-navy-700 bg-navy-800/40 px-4 py-4 sm:px-5">
      <h3 className="text-sm font-bold text-white">{t.summary}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{t.summaryNote}</p>
      {recent.length ? <ul className="mt-3 space-y-2 text-xs text-slate-200">
        {recent.map((event) => <li key={event.key} className="flex items-start gap-2"><bdi className="shrink-0 font-semibold text-navy-100">{eventMinute(event) ?? '—'}</bdi><span>{t.labels[event.type]}{event.player && <> · <bdi>{event.player}</bdi></>}{event.side !== 'unknown' && <> · <bdi>{event.side === 'home' ? match.home.name : match.away.name}</bdi></>}</span></li>)}
      </ul> : <p className="mt-3 text-xs text-slate-300">{t.noHighlights}</p>}
      {highlights.length > recent.length && <p className="mt-2 text-xs text-slate-400">{t.allHighlights}</p>}
    </div>}
    {omitted > 0 && <p role="note" className="px-4 pt-4 text-xs text-amber-200">{t.omitted}</p>}
    {events.length ? <EventTimeline events={events} locale={locale} homeName={match.home.name} awayName={match.away.name} /> : <p className="px-5 py-7 text-center text-sm leading-relaxed text-slate-300">{match.status === 'scheduled' ? t.scheduled : t.empty}</p>}
  </section>;
}

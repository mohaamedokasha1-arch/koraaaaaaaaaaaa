'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Locale } from '@/i18n/locales';
import type { LiveMatch } from '../types/index.ts';
import type { LiveScore } from '../hooks/useLiveScores';
import { getLiveCopy } from '../lib/copy.ts';

const tabs = ['lineup', 'stats', 'events', 'standings'] as const;
type Tab = typeof tabs[number];
export function MatchTabs({ match, score, locale }: { match: LiveMatch; score: LiveScore | null; locale: Locale }) {
  const [active, setActive] = useState<Tab>('events');
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const t = getLiveCopy(locale);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let target = index;
    if (event.key === 'ArrowRight') target = (index + (locale === 'ar' ? -1 : 1) + tabs.length) % tabs.length;
    else if (event.key === 'ArrowLeft') target = (index + (locale === 'ar' ? 1 : -1) + tabs.length) % tabs.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = tabs.length - 1;
    else return;
    event.preventDefault(); setActive(tabs[target]); buttons.current[target]?.focus();
  }
  const eventLabel = (type: string) => {
    const labels: Record<string, string> = locale === 'ar'
      ? { goal: 'هدف', own_goal: 'هدف عكسي', penalty_goal: 'هدف من ركلة جزاء', yellow: 'بطاقة صفراء', red: 'بطاقة حمراء', yellow_red: 'بطاقة حمراء', sub: 'تبديل' }
      : { goal: 'Goal', own_goal: 'Own goal', penalty_goal: 'Penalty goal', yellow: 'Yellow card', red: 'Red card', yellow_red: 'Red card', sub: 'Substitution' };
    return labels[type];
  };
  return <section className="card overflow-hidden">
    <div className="flex gap-1 overflow-x-auto border-b border-navy-700 p-2" role="tablist" aria-label={t.details}>
      {tabs.map((tab, index) => <button key={tab} ref={(element) => { buttons.current[index] = element; }} id={`match-tab-${tab}`} aria-controls={`match-panel-${tab}`} aria-selected={active === tab} tabIndex={active === tab ? 0 : -1} role="tab" type="button" onClick={() => setActive(tab)} onKeyDown={(event) => navigate(event, index)} className={`tab-btn shrink-0 ${active === tab ? 'tab-btn-active' : ''}`}>{t[tab]}</button>)}
    </div>
    {tabs.map((tab) => <div key={tab} id={`match-panel-${tab}`} role="tabpanel" aria-labelledby={`match-tab-${tab}`} hidden={active !== tab} tabIndex={0} className="p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300">
      {tab === 'events' ? score?.events.length ? <ol className="space-y-4">{score.events.map((event, index) => <li key={index} className="flex items-start gap-3 text-sm"><span dir="ltr" className="w-12 shrink-0 font-mono text-emerald-300">{event.minute ?? '–'}{event.extraMinute ? `+${event.extraMinute}` : ''}′</span><span><span className="font-semibold text-white">{eventLabel(event.type)}</span>{event.player && <span className="text-slate-300"> · {event.player}</span>}{event.playerIn && <span className="block text-xs text-slate-400">{event.playerIn}{event.playerOut ? ` ← ${event.playerOut}` : ''}</span>}</span></li>)}</ol> : <p className="text-sm text-slate-400">{t.noEvents}</p>
        : tab === 'standings' && match.competition.code ? <Link href={`/${locale}/leagues/${encodeURIComponent(match.competition.code)}?tab=standings`} className="btn-ghost">{t.openStandings}</Link> : <p className="text-sm text-slate-400">{t.unavailable}</p>}
      <Link href={`/${locale}/matches/${encodeURIComponent(match.matchId)}`} className="link-accent mt-5 inline-flex min-h-[40px] items-center text-xs">{t.details} ↗</Link>
    </div>)}
  </section>;
}

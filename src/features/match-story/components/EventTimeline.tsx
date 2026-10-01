'use client';

import { useId, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';
import type { Locale } from '@/i18n/locales';
import { storyCopy } from '../lib/copy';
import { adjacentSegment, eventMinute, filterStory, STORY_PAGE_SIZE, STORY_SEGMENTS, type StoryEvent, type StorySegment } from '../lib/model';

export function StoryEventIcon({ type }: { type: StoryEvent['type'] }) {
  const icon = type === 'yellow' ? '🟨' : type === 'red' || type === 'yellow_red' ? '🟥' : type === 'sub' ? '🔁' : '⚽';
  return <span className="text-base" aria-hidden="true">{icon}</span>;
}

/** Reusable, source-only RTL/LTR timeline. No fetch, storage, timers or chart SDK. */
export default function EventTimeline({ events, locale, homeName, awayName }: {
  events: readonly StoryEvent[]; locale: Locale; homeName: string; awayName: string;
}) {
  const t = storyCopy(locale);
  const uid = useId();
  const [segment, setSegment] = useState<StorySegment>('all');
  const [pageSize, setPageSize] = useState(STORY_PAGE_SIZE);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const filtered = filterStory(events, segment);
  const visible = filtered.slice(0, pageSize);
  const select = (value: StorySegment) => { setSegment(value); setPageSize(STORY_PAGE_SIZE); };
  const focusSegment = (value: StorySegment) => {
    select(value);
    tabs.current[STORY_SEGMENTS.indexOf(value)]?.focus({ preventScroll: true });
    tabs.current[STORY_SEGMENTS.indexOf(value)]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const delta = e.key === 'ArrowRight' ? (locale === 'ar' ? -1 : 1) : e.key === 'ArrowLeft' ? (locale === 'ar' ? 1 : -1) : 0;
    if (!delta && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    focusSegment(e.key === 'Home' ? 'all' : e.key === 'End' ? 'unknown' : adjacentSegment(segment, delta));
  };
  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || e.changedTouches.length !== 1) return;
    const end = e.changedTouches[0];
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    select(adjacentSegment(segment, (dx < 0 ? 1 : -1) * (locale === 'ar' ? -1 : 1)));
  };
  return <div dir={locale === 'ar' ? 'rtl' : 'ltr'}>
    <div role="tablist" aria-label={t.segmentLabel} className="flex gap-1 overflow-x-auto border-b border-navy-700 px-3 py-2">
      {STORY_SEGMENTS.map((value, index) => <button key={value} ref={(node) => { tabs.current[index] = node; }} type="button" role="tab"
        id={`${uid}-${value}`} aria-controls={`${uid}-panel`} aria-selected={segment === value} tabIndex={segment === value ? 0 : -1}
        onClick={() => select(value)} onKeyDown={onKeyDown}
        className={`min-h-11 shrink-0 rounded-lg px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-200 ${segment === value ? 'bg-navy-600 text-white' : 'text-slate-300 hover:bg-navy-800'}`}>
        {t.segments[value]}
      </button>)}
    </div>
    <p className="px-4 pt-3 text-xs leading-relaxed text-slate-400">{t.segmentNote}</p>
    <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-${segment}`} tabIndex={0} style={{ touchAction: 'pan-y pinch-zoom' }} className="px-4 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-200"
      onTouchStart={(e) => { touchStart.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }}
      onTouchEnd={onTouchEnd} onTouchCancel={() => { touchStart.current = null; }}>
      {filtered.length === 0 ? <p className="py-5 text-center text-sm text-slate-300" role="status">{t.noFiltered}</p> : <>
        <ol className="space-y-3 border-s border-navy-600 ps-4" aria-label={t.title}>
          {visible.map((event) => {
            const team = event.side === 'home' ? homeName : event.side === 'away' ? awayName : t.teamUnknown;
            const minute = eventMinute(event);
            const info = [[t.team, team], [t.player, event.player], [t.assist, event.assist], [t.playerIn, event.playerIn], [t.playerOut, event.playerOut]].filter((pair) => pair[1]);
            return <li key={event.key} className="relative" data-story-event={event.type} data-story-side={event.side}>
              <span aria-hidden="true" className="absolute -start-[1.3rem] top-5 h-2 w-2 rounded-full bg-navy-200 ring-4 ring-navy-900" />
              <details className="group rounded-lg border border-navy-700 bg-navy-950/50 open:bg-navy-800/40">
                <summary className="flex min-h-14 cursor-pointer list-none items-start gap-2 rounded-lg p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-200 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-10 shrink-0 text-center text-xs font-bold text-navy-100" aria-label={minute ?? t.minuteUnknown}><bdi>{minute ?? '—'}</bdi></span>
                  <StoryEventIcon type={event.type} />
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    <span className="block text-sm font-semibold text-white">{t.labels[event.type]}{event.player && <> · <bdi>{event.player}</bdi></>}</span>
                    <span className="mt-1 block text-xs text-slate-300"><bdi>{team}</bdi></span>
                  </span>
                  <span className="shrink-0 text-sm text-navy-200" aria-hidden="true">＋</span>
                </summary>
                <dl className="space-y-2 border-t border-navy-700 px-3 py-3 text-xs" aria-label={t.details}>
                  {info.map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt className="text-slate-400">{label}</dt><dd className="min-w-0 text-slate-100 [overflow-wrap:anywhere]"><bdi>{value}</bdi></dd></div>)}
                  {!event.player && !event.assist && !event.playerIn && !event.playerOut && <div><dt className="sr-only">{t.details}</dt><dd className="text-slate-300">{t.noDetails}</dd></div>}
                </dl>
              </details>
            </li>;
          })}
        </ol>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400" role="status">{t.shown}: <bdi>{visible.length}/{filtered.length}</bdi></p>
          {pageSize < filtered.length && <button type="button" className="btn-secondary min-h-11 text-xs" onClick={() => setPageSize((size) => size + STORY_PAGE_SIZE)}>{t.more}</button>}
        </div>
      </>}
    </div>
  </div>;
}

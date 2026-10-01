'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Locale } from '@/i18n/locales';
import type { LiveCatalog } from '../types/index.ts';
import { getLiveCopy } from '../lib/copy.ts';
import { coverageStreams } from '../lib/catalog.ts';
import { useLiveCatalog } from '../hooks/useLiveCatalog';
import { useLiveClock } from '../hooks/useLiveClock';
import { LiveMatchCard } from './LiveMatchCard';
import { LiveIcon } from './LiveIcon';

export function LiveHub({ initial, locale, initialStale, renderedAt }: { initial: LiveCatalog; locale: Locale; initialStale: boolean; renderedAt: number }) {
  const { catalog, stale } = useLiveCatalog(initial, initialStale);
  const now = useLiveClock(renderedAt) ?? renderedAt;
  const [competition, setCompetition] = useState('');
  const [team, setTeam] = useState('');
  const t = getLiveCopy(locale);
  const competitions = Array.from(new Map(catalog.matches.map((match) => [match.competition.id, match.competition.name])).entries());
  const teams = Array.from(new Map(catalog.matches.flatMap((match) => [[match.home.id, match.home.name], [match.away.id, match.away.name]] as [string, string][])).entries());
  const filtered = catalog.matches.filter((match) => (!competition || match.competition.id === competition) && (!team || match.home.id === team || match.away.id === team));
  const sections = [
    { status: 'live', title: t.live, empty: t.noLive },
    { status: 'scheduled', title: t.upcoming, empty: t.noUpcoming },
    { status: 'ended', title: t.ended, empty: t.noEnded },
  ] as const;
  return <div className="space-y-6">
    {stale && <p role="status" className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-sm text-amber-200">{t.stale}</p>}
    <div className="card flex flex-wrap items-end gap-3 p-4">
      <label className="min-w-0 flex-1 text-xs text-slate-400"><span className="mb-2 block">{t.competition}</span><select aria-label={t.competition} value={competition} onChange={(event) => setCompetition(event.target.value)} className="min-h-[44px] w-full rounded-lg border border-navy-600 bg-navy-900 px-3 text-sm text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"><option value="">{t.allCompetitions}</option>{competitions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="min-w-0 flex-1 text-xs text-slate-400"><span className="mb-2 block">{t.team}</span><select aria-label={t.team} value={team} onChange={(event) => setTeam(event.target.value)} className="min-h-[44px] w-full rounded-lg border border-navy-600 bg-navy-900 px-3 text-sm text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"><option value="">{t.allTeams}</option>{teams.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      {(competition || team) && <button type="button" className="btn-ghost !px-3" onClick={() => { setCompetition(''); setTeam(''); }}>{t.clearFilters}</button>}
    </div>
    {catalog.matches.length === 0 && <div className="card relative overflow-hidden px-6 py-12 text-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 pitch-pattern opacity-[0.07]" />
      <span className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/5 text-emerald-300"><LiveIcon name="tv" className="h-8 w-8" /></span>
      <h2 className="relative text-xl font-bold text-white">{t.emptyTitle}</h2><p className="relative mx-auto mt-3 max-w-md text-sm leading-7 text-slate-400">{t.emptyBody}</p>
      <Link href={`/${locale}/live`} className="btn-ghost relative mt-6">{t.scores}<LiveIcon name="arrow" className="h-4 w-4 rtl:rotate-180" /></Link>
    </div>}
    {catalog.matches.length > 0 && filtered.length === 0 && <p role="status" className="card p-6 text-center text-sm text-slate-400">{t.noResults}</p>}
    {sections.map((section) => {
      const matches = filtered.filter((match) => match.status === section.status).sort((a, b) => section.status === 'ended' ? Date.parse(b.startsAt) - Date.parse(a.startsAt) : Date.parse(a.startsAt) - Date.parse(b.startsAt));
      return <section key={section.status} aria-labelledby={`section-${section.status}`}>
        <div className="mb-3 flex items-center gap-3"><h2 id={`section-${section.status}`} className={`section-title ${section.status === 'live' ? 'text-red-400' : ''}`}>{section.status === 'live' && <span className="h-2 w-2 animate-pulseDot rounded-full bg-red-400" aria-hidden="true" />}{section.title}</h2><span className="chip tabular-nums">{matches.length}</span></div>
        {matches.length ? <div className="grid gap-3 sm:grid-cols-2">{matches.map((match) => <LiveMatchCard key={match.matchId} match={match} sourceCount={coverageStreams(catalog, match, now).length} locale={locale} />)}</div> : <p className="rounded-lg border border-dashed border-navy-700 px-4 py-5 text-sm text-slate-400">{section.empty}</p>}
      </section>;
    })}
  </div>;
}

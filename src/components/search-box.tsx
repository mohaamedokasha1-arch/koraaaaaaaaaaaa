'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import type { SearchHit } from '@/lib/types';
import { TeamLogo } from './team-logo';

export function SearchBox({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&lang=${locale}`);
        if (res.ok) {
          const json = (await res.json()) as { hits: SearchHit[] };
          setResults(json.hits);
          setOpen(true);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer.current);
  }, [q, locale]);

  function navigate(hit: SearchHit) {
    setOpen(false);
    setQ('');
    router.push(hit.kind === 'league' ? `/${locale}/leagues/${hit.code ?? hit.id}` : `/${locale}/teams/${hit.id}`);
  }

  const leagues = results.filter((r) => r.kind === 'league');
  const teams = results.filter((r) => r.kind === 'team');

  return (
    <div ref={boxRef} className="relative hidden sm:block">
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder={dict.search.placeholder}
          aria-label={dict.search.title}
          className="w-44 lg:w-64 rounded-lg border border-navy-600 bg-navy-800/80 py-2 ps-9 pe-3 text-sm text-white placeholder:text-slate-400 transition-colors hover:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-400 min-h-[40px]"
        />
        <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        {loading && (
          <span className="absolute end-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-white" aria-hidden="true" />
        )}
      </div>

      {open && q.trim().length >= 2 && (
        <div className="absolute start-0 end-0 sm:start-auto sm:end-0 sm:w-80 top-full mt-2 max-h-96 overflow-y-auto rounded-xl border border-navy-600 bg-navy-850 p-2 shadow-lift ring-1 ring-black/40">
          {results.length === 0 && !loading && (
            <p className="px-3 py-4 text-sm text-slate-400">{dict.common.emptySearch}</p>
          )}
          {leagues.length > 0 && (
            <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {dict.search.leaguesSection}
            </p>
          )}
          {leagues.map((hit) => (
            <button
              key={hit.id}
              type="button"
              onClick={() => navigate(hit)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start hover:bg-navy-800 min-h-[44px]"
            >
              <TeamLogo src={hit.emblem} alt="" size={22} />
              <span className="text-sm font-medium text-white">{'name' in hit ? hit.name : ''}</span>
              {'country' in hit && hit.country && (
                <span className="ms-auto text-xs text-slate-400">{hit.country}</span>
              )}
            </button>
          ))}
          {teams.length > 0 && (
            <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {dict.search.teamsSection}
            </p>
          )}
          {teams.map((hit) => (
            <button
              key={hit.id}
              type="button"
              onClick={() => navigate(hit)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start hover:bg-navy-800 min-h-[44px]"
            >
              <TeamLogo src={hit.crest} alt="" size={22} />
              <span className="text-sm font-medium text-white">{hit.name}</span>
              {'country' in hit && hit.country && (
                <span className="ms-auto text-xs text-slate-400">{hit.country}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

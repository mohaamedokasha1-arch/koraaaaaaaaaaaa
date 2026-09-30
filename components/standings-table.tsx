import Link from 'next/link';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import type { StandingRow } from '@/lib/types';
import { TeamLogo } from './team-logo';
import { num } from '@/lib/format';

const ZONE_CLASS: Record<NonNullable<StandingRow['zone']>, string> = {
  champions: 'border-s-4 border-s-pitch bg-pitch/5',
  europe: 'border-s-4 border-s-navy-400 bg-navy-500/5',
  relegation: 'border-s-4 border-s-red-500 bg-red-500/5',
};

export function StandingsTable({
  rows,
  locale,
  dict,
  highlightTeamId,
}: {
  rows: StandingRow[];
  locale: Locale;
  dict: Dictionary;
  highlightTeamId?: string;
}) {
  const t = dict.standings;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-navy-700 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2.5 text-center font-semibold w-10">{t.pos}</th>
              <th className="px-3 py-2.5 text-start font-semibold">{t.team}</th>
              <th className="px-2 py-2.5 text-center font-semibold">{t.played}</th>
              <th className="px-2 py-2.5 text-center font-semibold">{t.won}</th>
              <th className="px-2 py-2.5 text-center font-semibold">{t.drawn}</th>
              <th className="px-2 py-2.5 text-center font-semibold">{t.lost}</th>
              <th className="hidden sm:table-cell px-2 py-2.5 text-center font-semibold">{t.gf}</th>
              <th className="hidden sm:table-cell px-2 py-2.5 text-center font-semibold">{t.ga}</th>
              <th className="px-2 py-2.5 text-center font-semibold">{t.gd}</th>
              <th className="px-3 py-2.5 text-center font-bold text-slate-300">{t.points}</th>
              <th className="hidden md:table-cell px-3 py-2.5 text-center font-semibold">{t.form}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const zoneClass = r.zone ? ZONE_CLASS[r.zone] : '';
              const highlight = highlightTeamId && r.team.id === highlightTeamId ? 'bg-navy-700/40' : '';
              return (
                <tr
                  key={`${r.team.id}-${r.position}`}
                  className={`border-b border-navy-800/70 transition-colors hover:bg-navy-800/60 ${zoneClass} ${highlight}`}
                >
                  <td className="px-3 py-2.5 text-center font-semibold text-slate-300 tabular-nums">
                    {num(r.position, locale)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/${locale}/teams/${r.team.id}`}
                      className="flex items-center gap-2.5 hover:text-white"
                    >
                      <TeamLogo src={r.team.crest} alt={r.team.name} size={22} />
                      <span className="font-medium text-slate-100">{r.team.name}</span>
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-center text-slate-300 tabular-nums">{num(r.played, locale)}</td>
                  <td className="px-2 py-2.5 text-center text-slate-300 tabular-nums">{num(r.won, locale)}</td>
                  <td className="px-2 py-2.5 text-center text-slate-300 tabular-nums">{num(r.draw, locale)}</td>
                  <td className="px-2 py-2.5 text-center text-slate-300 tabular-nums">{num(r.lost, locale)}</td>
                  <td className="hidden sm:table-cell px-2 py-2.5 text-center text-slate-400 tabular-nums">{num(r.goalsFor, locale)}</td>
                  <td className="hidden sm:table-cell px-2 py-2.5 text-center text-slate-400 tabular-nums">{num(r.goalsAgainst, locale)}</td>
                  <td className="px-2 py-2.5 text-center text-slate-300 tabular-nums">
                    {r.goalDifference > 0 ? `+${num(r.goalDifference, locale)}` : num(r.goalDifference, locale)}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold text-white tabular-nums">{num(r.points, locale)}</td>
                  <td className="hidden md:table-cell px-3 py-2.5">
                    {r.form ? (
                      <div className="flex justify-center gap-1" aria-label={`${t.form}: ${r.form}`}>
                        {r.form.replace(/\s/g, '').slice(-5).split('').map((c, i) => (
                          <span
                            key={i}
                            className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white ${
                              c === 'W' ? 'bg-pitch' : c === 'D' ? 'bg-slate-500' : c === 'L' ? 'bg-red-500' : 'bg-navy-600'
                            }`}
                          >
                            {c === 'W' ? (locale === 'ar' ? 'ف' : 'W') : c === 'D' ? (locale === 'ar' ? 'ت' : 'D') : c === 'L' ? (locale === 'ar' ? 'خ' : 'L') : '·'}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="block text-center text-slate-500">–</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-4 border-t border-navy-700 px-4 py-3 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-pitch" aria-hidden="true" /> {t.championsLeague}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-navy-400" aria-hidden="true" /> {t.europe}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500" aria-hidden="true" /> {t.relegation}
        </span>
      </div>
    </div>
  );
}

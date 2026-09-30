import Link from 'next/link';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import type { Scorer } from '@/lib/types';
import { TeamLogo } from './team-logo';
import { num } from '@/lib/format';

export function ScorersTable({
  scorers,
  locale,
  dict,
  limit,
}: {
  scorers: Scorer[];
  locale: Locale;
  dict: Dictionary;
  limit?: number;
}) {
  const t = dict.scorers;
  const list = limit ? scorers.slice(0, limit) : scorers;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-navy-700 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2.5 text-center font-semibold w-10">{t.rank}</th>
              <th className="px-3 py-2.5 text-start font-semibold">{t.player}</th>
              <th className="px-3 py-2.5 text-start font-semibold">{t.team}</th>
              <th className="px-2 py-2.5 text-center font-bold text-slate-300">{t.goals}</th>
              <th className="px-2 py-2.5 text-center font-semibold">{t.assists}</th>
              <th className="hidden sm:table-cell px-2 py-2.5 text-center font-semibold">{t.penalties}</th>
              <th className="hidden sm:table-cell px-2 py-2.5 text-center font-semibold">{t.played}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={`${s.rank}-${s.name}`} className="border-b border-navy-800/70 transition-colors hover:bg-navy-800/60">
                <td className="px-3 py-2.5 text-center font-semibold text-slate-300 tabular-nums">{num(s.rank, locale)}</td>
                <td className="px-3 py-2.5 font-medium text-slate-100">{s.name}</td>
                <td className="px-3 py-2.5">
                  <Link href={`/${locale}/teams/${s.team.id}`} className="flex items-center gap-2 hover:text-white">
                    <TeamLogo src={s.team.crest} alt={s.team.name} size={20} />
                    <span className="text-slate-300">{s.team.name}</span>
                  </Link>
                </td>
                <td className="px-2 py-2.5 text-center font-bold text-white tabular-nums">{num(s.goals, locale)}</td>
                <td className="px-2 py-2.5 text-center text-slate-300 tabular-nums">{s.assists == null ? '–' : num(s.assists, locale)}</td>
                <td className="hidden sm:table-cell px-2 py-2.5 text-center text-slate-400 tabular-nums">{s.penalties == null ? '–' : num(s.penalties, locale)}</td>
                <td className="hidden sm:table-cell px-2 py-2.5 text-center text-slate-400 tabular-nums">{s.played == null ? '–' : num(s.played, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import Link from 'next/link';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import type { Scorer } from '@/lib/types';
import { TeamLogo } from './team-logo';
import { num } from '@/lib/format';
import { FavoriteButton } from '@/features/personalization/components/FavoriteButton';
import { favoriteForScorer } from '@/features/personalization/lib/catalog';
import { playerAnchor } from '@/features/personalization/lib/preferences';
import { getPersonalCopy } from '@/features/personalization/lib/copy';

export function ScorersTable({
  scorers,
  locale,
  dict,
  limit,
  leagueCode,
}: {
  scorers: Scorer[];
  locale: Locale;
  dict: Dictionary;
  limit?: number;
  leagueCode?: string;
}) {
  const t = dict.scorers;
  const list = limit ? scorers.slice(0, limit) : scorers;
  const favorites = list.map((scorer) => favoriteForScorer(scorer, leagueCode));
  const canFollow = favorites.some(Boolean);
  const personal = getPersonalCopy(locale);

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-navy-900/60">
            <tr className="border-b border-navy-700 text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-3 py-2.5 text-center font-semibold w-10">{t.rank}</th>
              <th className="px-3 py-2.5 text-start font-semibold">{t.player}</th>
              <th className="px-3 py-2.5 text-start font-semibold">{t.team}</th>
              <th className="px-2 py-2.5 text-center font-bold text-slate-300">{t.goals}</th>
              <th className="px-2 py-2.5 text-center font-semibold">{t.assists}</th>
              <th className="hidden sm:table-cell px-2 py-2.5 text-center font-semibold">{t.penalties}</th>
              <th className="hidden sm:table-cell px-2 py-2.5 text-center font-semibold">{t.played}</th>
              {canFollow && <th className="w-14 px-2 py-2.5 text-center"><span className="sr-only">{personal.follow}</span></th>}
            </tr>
          </thead>
          <tbody>
            {list.map((s, index) => (
              <tr
                id={favorites[index] ? playerAnchor(favorites[index]!.providerId!) : undefined}
                key={`${s.rank}-${s.name}`}
                className={`border-b border-navy-800/70 transition-colors hover:bg-navy-800/60 ${
                  s.rank === 1 ? 'bg-[rgba(217,169,63,0.06)] border-s-4 border-s-[#d9a93f]' : ''
                }`}
              >
                <td className="px-3 py-2.5 text-center">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-navy-800/80 text-xs font-bold text-slate-200 tabular-nums ring-1 ring-inset ring-navy-700/60">
                    {num(s.rank, locale)}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-medium text-slate-100">{s.name}</td>
                <td className="px-3 py-2.5">
                  <Link href={`/${locale}/teams/${s.team.id}`} className="flex items-center gap-2 hover:text-white">
                    <TeamLogo src={s.team.crest} alt={s.team.name} size={20} />
                    <span className="text-slate-300">{s.team.name}</span>
                  </Link>
                </td>
                <td className="px-2 py-2.5 text-center">
                  <span className="inline-flex min-w-[2rem] items-center justify-center rounded-md bg-navy-700/60 px-1.5 py-0.5 font-bold text-white tabular-nums ring-1 ring-inset ring-navy-600/50">
                    {num(s.goals, locale)}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-center text-slate-300 tabular-nums">{s.assists == null ? '–' : num(s.assists, locale)}</td>
                <td className="hidden sm:table-cell px-2 py-2.5 text-center text-slate-400 tabular-nums">{s.penalties == null ? '–' : num(s.penalties, locale)}</td>
                <td className="hidden sm:table-cell px-2 py-2.5 text-center text-slate-400 tabular-nums">{s.played == null ? '–' : num(s.played, locale)}</td>
                {canFollow && <td className="px-2 py-2.5 text-center">{favorites[index] && <FavoriteButton favorite={favorites[index]!} locale={locale} />}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

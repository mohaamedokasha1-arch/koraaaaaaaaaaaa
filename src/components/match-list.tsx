import Link from 'next/link';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import type { UnifiedMatch } from '@/lib/types';
import { MatchCard } from './match-card';
import { TeamLogo } from './team-logo';
import { EmptyState } from './empty-state';

function groupByLeague(matches: UnifiedMatch[]): Map<string, UnifiedMatch[]> {
  const map = new Map<string, UnifiedMatch[]>();
  for (const m of matches) {
    const key = `${m.league.code ?? m.league.name}`;
    const list = map.get(key);
    if (list) list.push(m);
    else map.set(key, [m]);
  }
  return map;
}

/**
 * Matches grouped under league headers, ordered by league then kickoff.
 */
export function MatchList({
  matches,
  locale,
  dict,
  tz,
  emptyTitle,
  emptyBody,
}: {
  matches: UnifiedMatch[];
  locale: Locale;
  dict: Dictionary;
  tz?: string;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (matches.length === 0) {
    return (
      <EmptyState
        title={emptyTitle ?? dict.common.emptyMatches}
        body={emptyBody ?? dict.common.emptyMatchesBody}
      />
    );
  }

  const groups = groupByLeague(matches);

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([key, ms]) => {
        const league = ms[0].league;
        return (
          <section key={key}>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-200">
              <span aria-hidden="true" className="h-4 w-[3px] rounded-full bg-[linear-gradient(180deg,#fbdf9b,#c8952c)]" />
              <TeamLogo src={league.emblem} alt={league.name} size={20} />
              {league.code ? (
                <Link
                  href={`/${locale}/leagues/${league.code}`}
                  className="hover:text-white hover:underline underline-offset-4"
                >
                  {league.name}
                </Link>
              ) : (
                league.name
              )}
              {league.country && <span className="font-normal text-slate-500">· {league.country}</span>}
            </h3>
            <div className="space-y-2">
              {ms.map((m) => (
                <MatchCard key={m.id} match={m} locale={locale} dict={dict} tz={tz} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

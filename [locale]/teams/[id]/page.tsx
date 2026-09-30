import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { getStandings, getTeamMemo as getTeam, getTeamMatches } from '@/lib/football';
import { TeamLogo } from '@/components/team-logo';
import { MatchList } from '@/components/match-list';
import { StandingsTable } from '@/components/standings-table';
import { EmptyState, ErrorState, StaleNotice } from '@/components/empty-state';
import { num } from '@/lib/format';
import type { SquadPlayer } from '@/lib/types';

export const dynamic = 'force-dynamic';

const TABS = ['matches', 'squad', 'standings', 'info'] as const;
type Tab = (typeof TABS)[number];

function isTab(v: string | undefined): v is Tab {
  return TABS.includes(v as Tab);
}

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale; id: string };
}): Promise<Metadata> {
  const dict = getDictionary(params.locale);
  try {
    const result = await getTeam(params.id);
    if (!result) return { title: dict.common.team };
    const name = result.data.name;
    return {
      title: `${name} - ${dict.teams.matches} & ${dict.teams.squad}`,
      description: `${name} - ${dict.teams.matches}, ${dict.teams.squad}, ${dict.teams.info} | ${dict.site.name}`,
    };
  } catch {
    return { title: dict.common.team };
  }
}

/** group squad into GK / DEF / MID / FWD buckets from provider position strings */
function groupSquad(squad: SquadPlayer[]): { key: string; label: string; players: SquadPlayer[] }[] {
  const buckets: Record<string, SquadPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [], OTHER: [] };
  for (const p of squad) {
    const pos = (p.position ?? '').toLowerCase();
    if (/goalkeep|keeper|gk/.test(pos)) buckets.GK.push(p);
    else if (/defen|back|centre-back|left-back|right-back/.test(pos)) buckets.DEF.push(p);
    else if (/midfield/.test(pos)) buckets.MID.push(p);
    else if (/forward|attack|wing|striker|offen/.test(pos)) buckets.FWD.push(p);
    else buckets.OTHER.push(p);
  }
  const order: [string, string][] = [
    ['GK', 'GK'], ['DEF', 'DEF'], ['MID', 'MID'], ['FWD', 'FWD'], ['OTHER', ''],
  ];
  return order
    .filter(([k]) => buckets[k].length > 0)
    .map(([k, label]) => ({ key: k, label, players: buckets[k] }));
}

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: { locale: Locale; id: string };
  searchParams: { tab?: string };
}) {
  const { locale, id } = params;
  const dict = getDictionary(locale);
  const tab: Tab = isTab(searchParams.tab) ? searchParams.tab! : 'matches';

  let teamResult = null;
  let failed = false;
  try {
    teamResult = await getTeam(id);
  } catch {
    failed = true;
  }
  if (!teamResult && !failed) notFound();
  if (failed || !teamResult) {
    return (
      <div className="container-page py-10">
        <ErrorState title={dict.common.errorTitle} body={dict.common.errorBody} />
      </div>
    );
  }

  const team = teamResult.data;

  const [recent, upcoming, standingsRes] = await Promise.all([
    tab === 'matches' ? getTeamMatches(id, 'recent').catch(() => null) : Promise.resolve(null),
    tab === 'matches' ? getTeamMatches(id, 'upcoming').catch(() => null) : Promise.resolve(null),
    tab === 'standings' && team.leagueCode
      ? getStandings(team.leagueCode).catch(() => null)
      : Promise.resolve(null),
  ]);

  const tabLabel: Record<Tab, string> = {
    matches: dict.teams.matches,
    squad: dict.teams.squad,
    standings: dict.teams.title === '' ? '' : dict.nav.standings,
    info: dict.teams.info,
  };

  const squadGroups = groupSquad(team.squad);
  const teamRow = standingsRes?.data.find((r) => r.team.id === team.id || r.team.name === team.shortName || r.team.name === team.name);

  return (
    <div className="container-page py-6 sm:py-8 space-y-6">
      <nav aria-label="breadcrumb" className="text-xs text-slate-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href={`/${locale}`} className="hover:text-slate-300">{dict.nav.home}</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href={`/${locale}/teams`} className="hover:text-slate-300">{dict.teams.title}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-slate-300">{team.name}</li>
        </ol>
      </nav>

      <header className="card flex flex-wrap items-center gap-4 px-5 py-5">
        <TeamLogo src={team.crest} alt={team.name} size={64} />
        <div className="min-w-0">
          <h1 className="truncate text-xl sm:text-2xl font-extrabold text-white">{team.name}</h1>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
            {team.country && <span>{dict.teams.country}: {team.country}</span>}
            {team.founded && <span>{dict.teams.founded} {num(team.founded, locale)}</span>}
            {team.venue && <span>{team.venue}</span>}
          </p>
        </div>
        {team.website && (
          <a
            href={team.website.startsWith('http') ? team.website : `https://${team.website}`}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="btn-ghost ms-auto text-xs"
          >
            {dict.teams.website} ↗
          </a>
        )}
      </header>

      {teamResult.stale && <StaleNotice message={dict.common.cachedNotice} />}

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={team.name}>
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/${locale}/teams/${id}?tab=${t}`}
            role="tab"
            aria-selected={tab === t}
            className={`tab-btn shrink-0 ${tab === t ? 'tab-btn-active' : ''}`}
          >
            {tabLabel[t]}
          </Link>
        ))}
      </div>

      {tab === 'matches' && (
        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="section-title mb-3">{dict.teams.recentMatches}</h2>
            {recent && recent.data.length > 0 ? (
              <MatchList matches={recent.data.slice(0, 8)} locale={locale} dict={dict} />
            ) : (
              <EmptyState title={dict.common.noData} body={dict.common.dataUnavailable} />
            )}
          </section>
          <section>
            <h2 className="section-title mb-3">{dict.teams.upcomingMatches}</h2>
            {upcoming && upcoming.data.length > 0 ? (
              <MatchList matches={upcoming.data.slice(0, 8)} locale={locale} dict={dict} />
            ) : (
              <EmptyState title={dict.common.noData} body={dict.common.dataUnavailable} />
            )}
          </section>
        </div>
      )}

      {tab === 'squad' && (
        squadGroups.length > 0 ? (
          <div className="space-y-6">
            {squadGroups.map((g) => (
              <section key={g.key}>
                {g.label && (
                  <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">{g.label}</h2>
                )}
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-navy-700 text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-2.5 text-center font-semibold w-12">{dict.teams.number}</th>
                        <th className="px-4 py-2.5 text-start font-semibold">{dict.teams.name}</th>
                        <th className="hidden sm:table-cell px-4 py-2.5 text-start font-semibold">{dict.teams.position}</th>
                        <th className="hidden md:table-cell px-4 py-2.5 text-start font-semibold">{dict.teams.nationality}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.players.map((p, i) => (
                        <tr key={`${p.name}-${i}`} className="border-b border-navy-800/70 hover:bg-navy-800/60 transition-colors">
                          <td className="px-4 py-2.5 text-center font-bold text-slate-300 tabular-nums">
                            {p.shirtNumber != null ? num(p.shirtNumber, locale) : '–'}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-slate-100">{p.name}</td>
                          <td className="hidden sm:table-cell px-4 py-2.5 text-slate-400">{p.position ?? '–'}</td>
                          <td className="hidden md:table-cell px-4 py-2.5 text-slate-400">{p.nationality ?? '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState title={dict.common.noData} body={dict.common.dataUnavailable} />
        )
      )}

      {tab === 'standings' && (
        standingsRes && standingsRes.data.length > 0 ? (
          <>
            {standingsRes.stale && <div className="mb-4"><StaleNotice message={dict.common.cachedNotice} /></div>}
            <StandingsTable
              rows={standingsRes.data}
              locale={locale}
              dict={dict}
              highlightTeamId={teamRow?.team.id}
            />
          </>
        ) : (
          <EmptyState title={dict.common.noData} body={dict.common.dataUnavailable} />
        )
      )}

      {tab === 'info' && (
        <section className="card overflow-hidden" aria-label={dict.teams.info}>
          <dl className="divide-y divide-navy-800/70">
            {[
              [dict.teams.country, team.country],
              [dict.teams.founded, team.founded ? String(team.founded) : null],
              [dict.teams.stadium, team.venue],
              [dict.teams.coach, team.coach],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between gap-4 px-4 sm:px-5 py-3">
                  <dt className="text-sm text-slate-400">{k}</dt>
                  <dd className="text-sm font-medium text-slate-100 text-end">{v}</dd>
                </div>
              ))}
          </dl>
          {team.squad.length === 0 && !team.country && !team.founded && (
            <p className="px-5 py-6 text-center text-sm text-slate-400">{dict.common.dataUnavailable}</p>
          )}
        </section>
      )}
    </div>
  );
}

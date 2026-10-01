import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { getStandings, getTeamMemo as getTeam, getTeamMatches } from '@/lib/football';
import { resolveTeamRoute, teamSlugValue } from '@/lib/entities';
import { h2hCandidatesFor } from '@/lib/h2h';
import { hasHistory } from '@/lib/historical';
import { leagueByCode } from '@/lib/constants';
import { getNewsBundle, newsEnabled } from '@/lib/news';
import { TeamLogo } from '@/components/team-logo';
import { MatchList } from '@/components/match-list';
import { StandingsTable } from '@/components/standings-table';
import { NewsList } from '@/components/news-list';
import { EmptyState, ErrorState, StaleNotice } from '@/components/empty-state';
import { num } from '@/lib/format';
import type { SquadPlayer } from '@/lib/types';
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from '@/lib/seo';
import { getUserTimeZone } from '@/lib/time';
import { FavoriteButton } from '@/features/personalization/components/FavoriteButton';
import { favoriteForTeam, favoriteForSquadPlayer } from '@/features/personalization/lib/catalog';
import { getPersonalCopy } from '@/features/personalization/lib/copy';
import { playerAnchor } from '@/features/personalization/lib/preferences';

export const dynamic = 'force-dynamic';

const BASE_TABS = ['matches', 'squad', 'standings', 'info'] as const;
const TABS = ['matches', 'news', 'squad', 'standings', 'info'] as const;
type Tab = (typeof TABS)[number];

function isTab(v: string | undefined): v is Tab {
  return TABS.includes(v as Tab);
}

/** A team page is worth indexing only when real, non-empty content sits behind it. */
function worthIndexing(team: { name: string; country?: string | null; squad: SquadPlayer[]; leagueCode?: string | null; founded?: number | null }): boolean {
  return Boolean(
    team.name &&
      (team.country || team.leagueCode || team.founded || team.squad.length > 0),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const dict = getDictionary(locale);
  const route = await resolveTeamRoute(id).catch(() => null);
  const path = `/teams/${route?.entity.slug ?? id}`;

  const fallbackName =
    route?.entity && !route.entity.name.includes('~') && (route.entity.refs.length > 0 || route.entity.nameAr || route.entity.country)
      ? route.entity.nameAr ?? route.entity.name
      : dict.common.team;

  try {
    const result = await getTeam(id);
    if (!result) {
      // Known club, provider payload not available yet → entity-only page.
      return pageMetadata({
        locale,
        path,
        title: dict.seo.teamTitle.replace('{name}', fallbackName),
        description: dict.seo.teamDesc.replace('{name}', fallbackName),
        indexable: false,
      });
    }
    const name = result.data.name;
    return pageMetadata({
      locale,
      path,
      title: dict.seo.teamTitle.replace('{name}', name),
      description: dict.seo.teamDesc.replace('{name}', name),
      indexable: worthIndexing(result.data),
    });
  } catch {
    // Provider outage: never let a temporary failure publish an indexable stub,
    // but keep a known club's name on the page rather than a generic label.
    return pageMetadata({
      locale,
      path,
      title: dict.seo.teamTitle.replace('{name}', fallbackName),
      description: dict.seo.teamDesc.replace('{name}', fallbackName),
      indexable: false,
    });
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

/** Minimal team view for an entity we know but whose provider has no data yet. */
function entityFallback(entity: { name: string; nameAr: string | null; country: string | null; leagueCodes: string[] }) {
  return {
    id: entity.name,
    name: entity.name,
    shortName: null,
    country: entity.country,
    founded: null,
    venue: null,
    website: null,
    crest: null,
    squad: [],
    leagueCode: entity.leagueCodes[0] ?? null,
    coach: null,
  };
}

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale, id } = await params;
  const tz = await getUserTimeZone();
  const { tab: tabParam } = await searchParams;
  const dict = getDictionary(locale);

  // Internal entity identity first: it is what makes slugs work and what keeps
  // legacy provider ids (`fd~57`) and their indexed URLs alive.
  const route = await resolveTeamRoute(id).catch(() => null);
  const entity = route?.entity ?? null;

  let teamResult = null;
  let failed = false;
  try {
    teamResult = await getTeam(id);
  } catch {
    failed = true;
  }
  // A REAL club we already know — even when the provider is temporarily down or
  // has no payload yet — renders an entity-only page (noindex) instead of a 404:
  // search and registry links stay alive, and the page becomes rich the moment
  // the provider answers again. An id we cannot back with anything, or a
  // provider-shaped id that resolves to nothing, stays a genuine 404.
  const knownEntity =
    entity && !entity.name.includes('~') && (entity.refs.length > 0 || Boolean(entity.nameAr) || Boolean(entity.country))
      ? entity
      : null;

  if (failed && !knownEntity) {
    return (
      <div className="container-page py-10">
        <ErrorState title={dict.common.errorTitle} body={dict.common.errorBody} />
      </div>
    );
  }
  if (!knownEntity && !teamResult) notFound();

  // Provider payload when it exists; otherwise the entity-only view (noindex).
  const team = teamResult?.data ?? entityFallback(knownEntity!);
  const providerData = Boolean(teamResult?.data);

  const entitySlug = knownEntity?.slug ?? entity?.slug ?? id;
  const canonicalPath = `/teams/${entitySlug}`;
  const requestedTab: Tab = isTab(tabParam) ? tabParam : 'matches';
  const tab: Tab = requestedTab === 'standings' && !team.leagueCode ? 'matches' : requestedTab;

  const [recent, upcoming, standingsRes, newsRes] = await Promise.all([
    providerData && tab === 'matches' ? getTeamMatches(id, 'recent').catch(() => null) : Promise.resolve(null),
    providerData && tab === 'matches' ? getTeamMatches(id, 'upcoming').catch(() => null) : Promise.resolve(null),
    providerData && tab === 'standings' && team.leagueCode
      ? getStandings(team.leagueCode).catch(() => null)
      : Promise.resolve(null),
    providerData && entity && newsEnabled()
      ? getNewsBundle({ entityId: entity.id, limit: 6 }).catch(() => null)
      : Promise.resolve(null),
  ]);

  // H2H links only for opponents this instance has really stored meetings against
  // (fewer than MIN_MEETINGS has no page, and a link to a 404 is worse than none).
  const h2hOpponents = providerData && entity ? h2hCandidatesFor(team.name, 6) : [];
  const archiveCode = team.leagueCode && hasHistory(team.leagueCode) ? team.leagueCode : null;

  const newsItems = newsRes?.data.entries ?? [];
  const visibleTabs = TABS.filter((candidate) => {
    if (candidate === 'news') return newsItems.length > 0;
    if (candidate === 'standings') return Boolean(team.leagueCode);
    return BASE_TABS.includes(candidate as (typeof BASE_TABS)[number]);
  });

  const tabLabel: Record<Tab, string> = {
    matches: dict.teams.matches,
    news: dict.teams.newsTitle.replace('{team}', team.name),
    squad: dict.teams.squad,
    standings: dict.nav.standings,
    info: dict.teams.info,
  };

  const league = team.leagueCode ? leagueByCode(team.leagueCode) : null;
  const leagueLabel = league ? (locale === 'ar' ? league.nameAr : league.nameEn) : team.leagueCode;
  const squadGroups = groupSquad(team.squad);
  const teamRow = standingsRes?.data.find((r) => r.team.id === team.id || r.team.name === team.shortName || r.team.name === team.name);
  const displayName = locale === 'ar' ? entity?.nameAr ?? team.name : team.name;
  const favorite = favoriteForTeam(team, team.leagueCode);
  const canFollowPlayers = team.squad.some((player) => Boolean(favoriteForSquadPlayer(player, team)));
  const personal = getPersonalCopy(locale);

  const teamJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: team.name,
    ...(locale === 'ar' && entity?.nameAr ? { alternateName: entity.nameAr } : {}),
    url: absoluteUrl(`/${locale}${canonicalPath}`),
    ...(team.crest ? { logo: team.crest } : {}),
    ...(team.country ? { location: { '@type': 'Country', name: team.country } } : {}),
    ...(team.venue ? { venue: { '@type': 'Place', name: team.venue } } : {}),
    ...(team.founded ? { foundingDate: String(team.founded) } : {}),
    ...(team.coach ? { coach: { '@type': 'Person', name: team.coach } } : {}),
    ...(team.leagueCode
      ? { memberOf: { '@type': 'SportsOrganization', name: leagueLabel ?? '' } }
      : {}),
  };

  return (
    <div className="container-page py-6 sm:py-8 space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd(
              [
                { name: dict.nav.home, path: '/' },
                { name: dict.nav.teams, path: '/teams' },
                { name: team.name, path: canonicalPath },
              ],
              locale,
            ),
          ),
        }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(teamJsonLd) }} />

      <nav aria-label="breadcrumb" className="text-xs text-slate-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href={`/${locale}`} className="hover:text-slate-300">{dict.nav.home}</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href={`/${locale}/teams`} className="hover:text-slate-300">{dict.teams.title}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-slate-300">{displayName}</li>
        </ol>
      </nav>

      <header className="card relative flex flex-wrap items-center gap-4 overflow-hidden px-5 py-5">
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 hero-glow opacity-70" />
        <span className="crest-tile relative h-20 w-20">
          <TeamLogo src={team.crest} alt={team.name} size={62} />
        </span>
        <div className="relative min-w-0">
          <h1 className="truncate text-xl sm:text-2xl font-extrabold tracking-tight text-white">{displayName}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {team.country && <span className="chip"><span className="text-slate-500">{dict.teams.country}:</span> {team.country}</span>}
            {team.founded && <span className="chip"><span className="text-slate-500">{dict.teams.founded}</span> {num(team.founded, locale)}</span>}
            {team.venue && <span className="chip">{team.venue}</span>}
            {team.leagueCode && (
              <Link href={`/${locale}/leagues/${team.leagueCode}`} className="chip hover:border-navy-500">
                {dict.teams.inLeague.replace('{league}', leagueLabel ?? '')}
              </Link>
            )}
          </p>
        </div>
        {favorite && <div className="relative ms-auto"><FavoriteButton favorite={favorite} locale={locale} compact={false} /></div>}
        {team.website && (
          <a
            href={team.website.startsWith('http') ? team.website : `https://${team.website}`}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="btn-ghost relative ms-auto text-xs"
          >
            {dict.teams.website} ↗
          </a>
        )}
      </header>

      {teamResult?.stale && <StaleNotice message={dict.common.cachedNotice} />}

      {(h2hOpponents.length > 0 || archiveCode) && (
        <section className="card flex flex-wrap items-center gap-2 px-4 py-3" aria-label={dict.teams.h2hTitle}>
          <span className="text-xs font-semibold text-slate-400">{dict.teams.h2hTitle}:</span>
          {h2hOpponents.map((opponent) => (
            <Link
              key={opponent.name}
              href={`/${locale}/h2h/${entitySlug}/${teamSlugValue(opponent.name)}`}
              className="chip hover:border-navy-500"
            >
              {opponent.name} <span className="text-[10px] text-slate-500 tabular-nums">{opponent.count}</span>
            </Link>
          ))}
          {archiveCode && (
            <Link href={`/${locale}/leagues/${archiveCode}/archive`} className="link-accent ms-auto text-xs font-semibold">
              {dict.teams.archiveTitle}
            </Link>
          )}
        </section>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={team.name}>
        {visibleTabs.map((t) => (
          <Link
            key={t}
            href={`/${locale}${canonicalPath}?tab=${t}`}
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
              <MatchList matches={recent.data.slice(0, 8)} locale={locale} dict={dict} tz={tz} />
            ) : (
              <EmptyState title={dict.common.noData} body={dict.common.dataUnavailable} />
            )}
          </section>
          <section>
            <h2 className="section-title mb-3">{dict.teams.upcomingMatches}</h2>
            {upcoming && upcoming.data.length > 0 ? (
              <MatchList matches={upcoming.data.slice(0, 8)} locale={locale} dict={dict} tz={tz} />
            ) : (
              <EmptyState title={dict.common.noData} body={dict.common.dataUnavailable} />
            )}
          </section>
        </div>
      )}

      {tab === 'news' && (
        <section>
          <h2 className="section-title mb-3">{tabLabel.news}</h2>
          {newsItems.length > 0 ? (
            <NewsList items={newsItems} locale={locale} dict={dict} />
          ) : (
            <EmptyState title={dict.news.empty} body={dict.news.emptyBody} />
          )}
        </section>
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
                        {canFollowPlayers && <th className="w-14 px-2 py-2.5 text-center"><span className="sr-only">{personal.follow}</span></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {g.players.map((p, i) => {
                        const playerFavorite = favoriteForSquadPlayer(p, team);
                        return (
                        <tr id={playerFavorite ? playerAnchor(playerFavorite.providerId!) : undefined} key={`${p.name}-${i}`} className="border-b border-navy-800/70 hover:bg-navy-800/60 transition-colors">
                          <td className="px-4 py-2.5 text-center font-bold text-slate-300 tabular-nums">
                            {p.shirtNumber != null ? num(p.shirtNumber, locale) : '–'}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-slate-100">{p.name}</td>
                          <td className="hidden sm:table-cell px-4 py-2.5 text-slate-400">{p.position ?? '–'}</td>
                          <td className="hidden md:table-cell px-4 py-2.5 text-slate-400">{p.nationality ?? '–'}</td>
                          {canFollowPlayers && <td className="px-2 py-2.5 text-center">{playerFavorite && <FavoriteButton favorite={playerFavorite} locale={locale} />}</td>}
                        </tr>
                        );
                      })}
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

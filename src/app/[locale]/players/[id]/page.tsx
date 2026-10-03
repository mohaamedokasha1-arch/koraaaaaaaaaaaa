import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { getTeamMemo as getTeam, getScorers } from '@/lib/football';
import { decodePlayerId, findPlayerInTeam, ageFromBirthDate } from '@/lib/players';
import { leagueByCode } from '@/lib/constants';
import { TeamLogo } from '@/components/team-logo';
import { EmptyState } from '@/components/empty-state';
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from '@/lib/seo';
import { formatFullDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Player profile page (`/players/<teamEntityId>~<personId>`).
 *
 * Deliberately NOT a global player database: see docs comment in
 * src/lib/players.ts for why (a real, documented test showed free global
 * player-search/lookup data can be wrong for well-known players). This page
 * only ever shows a player who is found, right now, inside their team's own
 * current squad list from an already-trusted provider call — the exact same
 * data already rendered on the team's "squad" tab, just given its own URL.
 */

async function resolve(id: string) {
  const decoded = decodePlayerId(id);
  if (!decoded) return null;
  const teamResult = await getTeam(decoded.teamId).catch(() => null);
  if (!teamResult?.data) return null;
  const player = findPlayerInTeam(teamResult.data, decoded.personId);
  if (!player) return null;
  return { team: teamResult.data, player, stale: teamResult.stale };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const dict = getDictionary(locale);
  const resolved = await resolve(id).catch(() => null);
  const path = `/players/${id}`;

  if (!resolved) {
    return pageMetadata({
      locale,
      path,
      title: dict.players.notFound,
      description: dict.players.notFoundBody,
      indexable: false,
    });
  }

  const title = dict.seo.playerTitle.replace('{name}', resolved.player.name).replace('{team}', resolved.team.name);
  const description = dict.seo.playerDesc.replace('{name}', resolved.player.name).replace('{team}', resolved.team.name);
  return pageMetadata({
    locale,
    path,
    title,
    description,
    indexable: true,
    image: resolved.team.crest ?? undefined,
  });
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  const dict = getDictionary(locale);
  const resolved = await resolve(id).catch(() => null);

  if (!resolved) notFound();
  const { team, player } = resolved;

  // Best-effort enrichment from the league's top scorers (same person id,
  // same provider) — purely additive, never required for the page to render.
  let stats: { goals: number; assists: number | null; penalties: number | null; played: number | null } | null = null;
  if (team.leagueCode && player.id) {
    try {
      const scorers = await getScorers(team.leagueCode);
      const hit = scorers.data.find((s) => s.playerId === player.id);
      if (hit) stats = { goals: hit.goals, assists: hit.assists, penalties: hit.penalties, played: hit.played };
    } catch {
      stats = null;
    }
  }

  const league = team.leagueCode ? leagueByCode(team.leagueCode) : null;
  const leagueLabel = league ? (locale === 'ar' ? league.nameAr : league.nameEn) : null;
  const age = ageFromBirthDate(player.dateOfBirth);
  const canonicalPath = `/players/${id}`;

  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: player.name,
    ...(player.nationality ? { nationality: player.nationality } : {}),
    ...(player.dateOfBirth ? { birthDate: player.dateOfBirth } : {}),
    url: absoluteUrl(`/${locale}${canonicalPath}`),
    memberOf: {
      '@type': 'SportsTeam',
      name: team.name,
      url: absoluteUrl(`/${locale}/teams/${team.id}`),
    },
    ...(player.position ? { jobTitle: player.position } : {}),
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
                { name: team.name, path: `/teams/${team.id}` },
                { name: player.name, path: canonicalPath },
              ],
              locale,
            ),
          ),
        }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }} />

      <nav aria-label="breadcrumb" className="text-xs text-slate-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href={`/${locale}`} className="hover:text-slate-300">{dict.nav.home}</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href={`/${locale}/teams/${team.id}`} className="hover:text-slate-300">{team.name}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-slate-300">{player.name}</li>
        </ol>
      </nav>

      <header className="card flex flex-wrap items-center gap-4 p-5">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-navy-700 text-2xl font-bold text-slate-200">
          {player.shirtNumber != null ? player.shirtNumber : player.name.charAt(0)}
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-white">{player.name}</h1>
          <Link
            href={`/${locale}/teams/${team.id}`}
            className="mt-1 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
          >
            <TeamLogo src={team.crest} alt={team.name} size={18} />
            {dict.players.currentTeam}: {team.name}
            {leagueLabel ? ` · ${leagueLabel}` : ''}
          </Link>
        </div>
      </header>

      <section className="card overflow-hidden" aria-label={dict.players.profile}>
        <dl className="divide-y divide-navy-800/70">
          {[
            [dict.players.position, player.position],
            [dict.players.nationality, player.nationality],
            [dict.players.shirtNumber, player.shirtNumber != null ? String(player.shirtNumber) : null],
            [dict.players.dateOfBirth, player.dateOfBirth ? formatFullDate(player.dateOfBirth, locale).split(',')[0] : null],
            [dict.players.age, age != null ? dict.players.ageYears.replace('{n}', String(age)) : null],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between gap-4 px-4 sm:px-5 py-3">
                <dt className="text-sm text-slate-400">{k}</dt>
                <dd className="text-sm font-medium text-slate-100 text-end">{v}</dd>
              </div>
            ))}
        </dl>
        {!player.position && !player.nationality && !player.dateOfBirth && player.shirtNumber == null && (
          <div className="p-4">
            <EmptyState title={dict.common.noData} body={dict.common.dataUnavailable} />
          </div>
        )}
      </section>

      {stats && (
        <section className="card overflow-hidden" aria-label={dict.players.seasonStats}>
          <h2 className="section-title px-4 sm:px-5 pt-4">{dict.players.seasonStats}</h2>
          <dl className="grid grid-cols-3 gap-px bg-navy-800/70 mt-3">
            {[
              [dict.players.goals, stats.goals],
              [dict.players.assists, stats.assists],
              [dict.players.played, stats.played],
            ].map(([k, v]) => (
              <div key={k as string} className="bg-navy-900 px-3 py-4 text-center">
                <dt className="text-xs text-slate-400">{k}</dt>
                <dd className="mt-1 text-xl font-extrabold text-white tabular-nums">{v == null ? '–' : v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <p className="text-xs text-slate-500">{dict.players.dataNote}</p>
    </div>
  );
}

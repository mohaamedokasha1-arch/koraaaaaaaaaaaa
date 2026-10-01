import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { leagueByCode } from '@/lib/constants';
import {
  getHistoricalSeason,
  groupByMatchday,
  hasHistory,
  historySeasons,
  isKnownSeason,
  HISTORY_ATTRIBUTION,
} from '@/lib/historical';
import { computeStandings, seasonTeams } from '@/lib/pure/standings';
import { seasonDisplayLabel } from '@/lib/pure/season';
import { breadcrumbJsonLd, pageMetadata } from '@/lib/seo';
import { StandingsTable } from '@/components/standings-table';
import { MatchList } from '@/components/match-list';
import { EmptyState } from '@/components/empty-state';
import { getUserTimeZone } from '@/lib/time';

export const dynamic = 'force-dynamic';

/**
 * Season archive.
 *
 *   /l/<locale>/leagues/EGY/archive              → list of seasons that really exist
 *   /<locale>/leagues/EGY/archive/2024-25        → one season: computed table,
 *                                                  matchdays, clubs
 *
 * Everything comes from the openfootball CC0 dataset; the table is COMPUTED from
 * the real results and labelled as such, because the dataset ships fixtures, not
 * an official table. Seasons that are not in the dataset produce no page at all.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; code: string; season?: string[] }>;
}): Promise<Metadata> {
  const { locale, code, season } = await params;
  const dict = getDictionary(locale);
  const league = leagueByCode(code.toUpperCase());
  const label = season?.[0];

  if (!league || !hasHistory(league.fdCode)) {
    return pageMetadata({ locale, path: `/leagues/${code}/archive`, title: dict.archive.title, description: dict.archive.subtitle, indexable: false });
  }

  if (label) {
    if (!isKnownSeason(league.fdCode, label)) {
      return pageMetadata({ locale, path: `/leagues/${code}/archive`, title: dict.archive.title, description: dict.archive.subtitle, indexable: false });
    }
    const result = await getHistoricalSeason(league.fdCode, label).catch(() => null);
    const indexable = Boolean(result && result.data.length > 0);
    return pageMetadata({
      locale,
      path: `/leagues/${code.toUpperCase()}/archive/${label}`,
      title: `${league.nameEn} — ${dict.archive.season.replace('{season}', seasonDisplayLabel(label))}`,
      description: `${dict.archive.computedNotice} ${league.nameEn} ${seasonDisplayLabel(label)}.`,
      indexable,
    });
  }

  return pageMetadata({
    locale,
    path: `/leagues/${league.fdCode}/archive`,
    title: `${league.nameEn} — ${dict.archive.title}`,
    description: dict.archive.subtitle,
    indexable: historySeasons(league.fdCode).length > 0,
  });
}

export default async function ArchivePage({
  params,
}: {
  params: Promise<{ locale: Locale; code: string; season?: string[] }>;
}) {
  const { locale, code, season } = await params;
  const tz = await getUserTimeZone();
  const dict = getDictionary(locale);
  const league = leagueByCode(code.toUpperCase());
  if (!league || !hasHistory(league.fdCode)) notFound();

  const seasons = historySeasons(league.fdCode);
  const label = season?.[0];

  const breadcrumbs = breadcrumbJsonLd(
    [
      { name: dict.nav.home, path: '/' },
      { name: league.nameEn, path: `/leagues/${league.fdCode}` },
      { name: dict.archive.title, path: `/leagues/${league.fdCode}/archive` },
    ],
    locale,
  );

  // ── Season list ────────────────────────────────────────────────────────────
  if (!label) {
    return (
      <div className="container-page py-6 sm:py-8 space-y-6">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
        <header>
          <h1 className="text-xl font-extrabold text-white sm:text-2xl">
            {locale === 'ar' ? league.nameAr : league.nameEn} — {dict.archive.title}
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">{dict.archive.subtitle}</p>
        </header>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {seasons.map((seasonLabel) => (
            <li key={seasonLabel}>
              <Link
                href={`/${locale}/leagues/${league.fdCode}/archive/${seasonLabel}`}
                className="card card-hover flex items-center justify-between px-4 py-3"
              >
                <span className="text-sm font-semibold text-white">{seasonDisplayLabel(seasonLabel)}</span>
                <span aria-hidden="true" className="text-slate-500 rtl:-scale-x-100">←</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">{dict.archive.attribution}</p>
      </div>
    );
  }

  // ── One season ─────────────────────────────────────────────────────────────
  if (!isKnownSeason(league.fdCode, label)) notFound();
  const result = await getHistoricalSeason(league.fdCode, label).catch(() => null);
  const matches = result?.data ?? [];
  if (matches.length === 0) {
    return (
      <div className="container-page py-6 sm:py-8">
        <EmptyState title={dict.archive.empty} body={dict.archive.emptyBody} />
        <div className="mt-4 text-center">
          <Link href={`/${locale}/leagues/${league.fdCode}/archive`} className="link-accent text-sm">
            {dict.archive.back}
          </Link>
        </div>
      </div>
    );
  }

  const table = computeStandings(matches);
  const teams = seasonTeams(matches);
  const matchdays = groupByMatchday(matches);

  return (
    <div className="container-page py-6 sm:py-8 space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />

      <nav aria-label="breadcrumb" className="text-xs text-slate-500">
        <Link href={`/${locale}/leagues/${league.fdCode}`} className="hover:text-slate-300">
          {locale === 'ar' ? league.nameAr : league.nameEn}
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/${locale}/leagues/${league.fdCode}/archive`} className="hover:text-slate-300">
          {dict.archive.title}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-slate-300">{seasonDisplayLabel(label)}</span>
      </nav>

      <header>
        <h1 className="text-xl font-extrabold text-white sm:text-2xl">
          {locale === 'ar' ? league.nameAr : league.nameEn} — {seasonDisplayLabel(label)}
        </h1>
        <p className="mt-1.5 text-xs text-slate-500">
          {dict.archive.computedNotice} {dict.archive.attribution}
        </p>
      </header>

      <section>
        <h2 className="section-title mb-3">{dict.archive.computedTable}</h2>
        <StandingsTable rows={table.map((row) => ({
          position: row.position,
          team: { id: row.teamId, name: row.teamName, shortName: null, crest: null },
          played: row.played,
          won: row.won,
          draw: row.drawn,
          lost: row.lost,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          goalDifference: row.goalDifference,
          points: row.points,
          form: row.form.join(''),
          zone: null,
          group: null,
        }))} locale={locale} dict={dict} />
      </section>

      <section>
        <h2 className="section-title mb-3">{dict.archive.teams} ({teams.length})</h2>
        <ul className="flex flex-wrap gap-2">
          {teams.map((team) => (
            <li key={team.id} className="chip">{team.name}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-6">
        <h2 className="section-title">{dict.archive.matches}</h2>
        {matchdays.slice(0, 10).map((group) => (
          <div key={group.matchday ?? 'unknown'}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              {group.matchday != null ? dict.archive.matchday.replace('{n}', String(group.matchday)) : ''}
            </h3>
            <MatchList matches={group.matches} locale={locale} dict={dict} tz={tz} />
          </div>
        ))}
      </section>

      <p className="text-xs text-slate-500">
        <a href={HISTORY_ATTRIBUTION.url} target="_blank" rel="noopener noreferrer" className="link-accent">
          {HISTORY_ATTRIBUTION.name}
        </a>{' '}
        — {HISTORY_ATTRIBUTION.licence}
      </p>
    </div>
  );
}

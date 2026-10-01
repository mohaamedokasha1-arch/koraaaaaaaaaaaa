import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { resolveTeamRoute } from '@/lib/entities';
import { getHeadToHead, archiveLeagueCodesFor } from '@/lib/h2h';
import { breadcrumbJsonLd, pageMetadata } from '@/lib/seo';
import { MatchList } from '@/components/match-list';
import { EmptyState } from '@/components/empty-state';
import { getUserTimeZone } from '@/lib/time';

export const dynamic = 'force-dynamic';

/**
 * Head-to-head page (`/h2h/<team-a>/<team-b>`).
 *
 * Created ONLY when real meetings exist in stored data (live cache + open
 * historical datasets). A pair that never met has no page — no thin archive, no
 * fabricated 0-0 history. Canonical is the self URL, ordered alphabetically by
 * slug so `/h2h/a/b` and `/h2h/b/a` cannot become two indexed duplicates.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; a: string; b: string }>;
}): Promise<Metadata> {
  const { locale, a, b } = await params;
  const dict = getDictionary(locale);
  const [teamA, teamB] = await Promise.all([resolveTeamRoute(a), resolveTeamRoute(b)]);
  if (!teamA || !teamB) return pageMetadata({ locale, path: `/h2h/${a}/${b}`, title: dict.h2h.title, description: dict.h2h.computedNotice, indexable: false });

  const [first, second] = orderedSlugs(a, b);
  const result = await getHeadToHead(
    teamA.entity.name,
    teamA.entity.slug,
    teamB.entity.name,
    teamB.entity.slug,
    { leagueCodes: archiveLeagueCodesFor(teamA.entity.leagueCodes[0] ?? null) },
  ).catch(() => null);

  const enough = Boolean(result?.data);
  const title = `${teamA.entity.name} × ${teamB.entity.name} — ${dict.h2h.title}`;
  return pageMetadata({
    locale,
    path: `/h2h/${first}/${second}`,
    title,
    description: dict.h2h.computedNotice,
    indexable: enough,
  });
}

function orderedSlugs(a: string, b: string): [string, string] {
  return a.toLowerCase() <= b.toLowerCase() ? [a, b] : [b, a];
}

export default async function H2HPage({
  params,
}: {
  params: Promise<{ locale: Locale; a: string; b: string }>;
}) {
  const { locale, a, b } = await params;
  const tz = await getUserTimeZone();
  const dict = getDictionary(locale);

  const [teamA, teamB] = await Promise.all([resolveTeamRoute(a), resolveTeamRoute(b)]);
  if (!teamA || !teamB || teamA.entity.id === teamB.entity.id) notFound();

  const leagueCodes = [
    ...new Set([
      ...teamA.entity.leagueCodes,
      ...teamB.entity.leagueCodes,
      ...archiveLeagueCodesFor(teamA.entity.leagueCodes[0] ?? null),
    ]),
  ];

  const result = await getHeadToHead(
    teamA.entity.name,
    teamA.entity.slug,
    teamB.entity.name,
    teamB.entity.slug,
    { leagueCodes },
  ).catch(() => null);

  if (!result?.data) notFound();
  const summary = result.data.summary;

  const display = (entity: typeof teamA.entity) =>
    locale === 'ar' ? entity.nameAr ?? entity.name : entity.name;

  const breadcrumbs = breadcrumbJsonLd(
    [
      { name: dict.nav.home, path: '/' },
      { name: dict.teams.h2hTitle, path: `/h2h/${a}/${b}` },
    ],
    locale,
  );

  const stats = [
    { label: dict.h2h.meetings, value: summary.total },
    { label: dict.h2h.wins.replace('{team}', display(teamA.entity)), value: summary.teamAWins },
    { label: dict.h2h.draws, value: summary.draws },
    { label: dict.h2h.wins.replace('{team}', display(teamB.entity)), value: summary.teamBWins },
    { label: dict.h2h.goals, value: `${summary.teamAGoals} - ${summary.teamBGoals}` },
  ];

  return (
    <div className="container-page py-6 sm:py-8 space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />

      <nav aria-label="breadcrumb" className="text-xs text-slate-500">
        <Link href={`/${locale}`} className="hover:text-slate-300">{dict.nav.home}</Link>
        <span aria-hidden="true"> / </span>
        <span className="text-slate-300">{dict.h2h.title}</span>
      </nav>

      <header className="card px-5 py-5">
        <h1 className="text-lg font-extrabold text-white sm:text-xl">
          <Link href={`/${locale}/teams/${teamA.entity.slug}`} className="hover:text-white">
            {display(teamA.entity)}
          </Link>
          <span className="mx-2 text-slate-500">×</span>
          <Link href={`/${locale}/teams/${teamB.entity.slug}`} className="hover:text-white">
            {display(teamB.entity)}
          </Link>
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          {dict.h2h.computedNotice}
          {result.data.includesArchive ? ` ${dict.h2h.fromArchive}` : ''}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg bg-navy-900/70 px-3 py-2">
              <dt className="text-[11px] text-slate-500">{stat.label}</dt>
              <dd className="text-base font-bold text-white tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
        {summary.competitions.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            {summary.competitions.map((competition) => (
              <span key={`${competition.code ?? competition.name}`} className="chip">
                {competition.name} · {competition.count}
              </span>
            ))}
          </p>
        )}
      </header>

      <section>
        <h2 className="section-title mb-3">{dict.h2h.lastMeeting}</h2>
        {summary.matches.length > 0 ? (
          <MatchList matches={summary.matches} locale={locale} dict={dict} tz={tz} />
        ) : (
          <EmptyState title={dict.h2h.notEnough} body={dict.h2h.computedNotice} />
        )}
      </section>
    </div>
  );
}

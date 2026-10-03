import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/i18n/dictionaries';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { tournamentBySlug, getTournamentStandings, getTournamentSchedule } from '@/lib/tournaments';
import { TeamLogo } from '@/components/team-logo';
import { StandingsTable } from '@/components/standings-table';
import { MatchCard } from '@/components/match-card';
import { EmptyState, StaleNotice } from '@/components/empty-state';
import { breadcrumbJsonLd, pageMetadata } from '@/lib/seo';
import { getUserTimeZone } from '@/lib/time';

export const dynamic = 'force-dynamic';

const TABS = ['groups', 'schedule'] as const;
type Tab = (typeof TABS)[number];
function isTab(v: string | undefined): v is Tab {
  return TABS.includes(v as Tab);
}

function roundLabel(slug: string | null, dict: Dictionary): string {
  if (!slug) return dict.tournaments.scheduleTab;
  const known = (dict.tournaments.rounds as Record<string, string>)[slug];
  if (known) return known;
  return slug
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const dict = getDictionary(locale);
  const config = tournamentBySlug(slug);
  const name = config ? (locale === 'ar' ? config.nameAr : config.nameEn) : slug;
  return pageMetadata({
    locale,
    path: `/tournaments/${slug}`,
    title: dict.seo.tournamentTitle.replace('{name}', name),
    description: dict.seo.tournamentDesc.replace('{name}', name),
    indexable: Boolean(config),
  });
}

export default async function TournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale, slug } = await params;
  const { tab: tabParam } = await searchParams;
  const dict = getDictionary(locale);
  const tz = await getUserTimeZone();
  const config = tournamentBySlug(slug);
  if (!config) notFound();

  const tab: Tab = isTab(tabParam) ? tabParam : 'groups';
  const name = locale === 'ar' ? config.nameAr : config.nameEn;

  const [standings, schedule] = await Promise.all([
    getTournamentStandings(config),
    getTournamentSchedule(config),
  ]);
  const stale = standings.stale || schedule.stale;

  const groups = new Map<string, typeof standings.data>();
  for (const row of standings.data) {
    const key = row.group ?? '—';
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }
  const groupNames = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

  const tabLabel: Record<Tab, string> = {
    groups: dict.tournaments.groupsTab,
    schedule: dict.tournaments.scheduleTab,
  };

  return (
    <div className="container-page py-6 sm:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd(
              [
                { name: dict.nav.home, path: '/' },
                { name: dict.tournaments.title, path: '/tournaments' },
                { name, path: `/tournaments/${slug}` },
              ],
              locale,
            ),
          ),
        }}
      />

      <nav aria-label="breadcrumb" className="mb-4 text-xs text-slate-500">
        <ol className="flex items-center gap-1.5">
          <li><Link href={`/${locale}`} className="hover:text-slate-300">{dict.nav.home}</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href={`/${locale}/tournaments`} className="hover:text-slate-300">{dict.tournaments.title}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-slate-300">{name}</li>
        </ol>
      </nav>

      <header className="card relative flex items-center gap-4 overflow-hidden px-5 py-5">
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 hero-glow opacity-70" />
        <span className="crest-tile relative h-16 w-16">
          <TeamLogo src={config.logo} alt={name} size={48} />
        </span>
        <div className="relative min-w-0">
          <h1 className="truncate text-xl sm:text-2xl font-extrabold tracking-tight text-white">{name}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <span className="chip">{locale === 'ar' ? config.countryAr : config.countryEn}</span>
          </p>
        </div>
      </header>

      {stale && <div className="mt-4"><StaleNotice message={dict.common.cachedNotice} /></div>}

      <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={name}>
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/${locale}/tournaments/${slug}?tab=${t}`}
            role="tab"
            aria-selected={tab === t}
            className={`tab-btn shrink-0 ${tab === t ? 'tab-btn-active' : ''}`}
          >
            {tabLabel[t]}
          </Link>
        ))}
      </div>

      <div className="mt-4 space-y-6">
        {tab === 'groups' &&
          (groupNames.length > 0 ? (
            groupNames.map((g) => (
              <section key={g}>
                <h2 className="section-title mb-2">
                  {g === '—' ? dict.tournaments.groupsTab : `${dict.tournaments.group} ${g.replace(/^Group\s*/i, '')}`}
                </h2>
                <StandingsTable rows={groups.get(g)!} locale={locale} dict={dict} />
              </section>
            ))
          ) : (
            <EmptyState title={dict.common.noData} body={dict.tournaments.noGroups} />
          ))}

        {tab === 'schedule' &&
          (schedule.data.length > 0 ? (
            schedule.data.map((round) => (
              <section key={round.slug ?? 'unlabeled'}>
                <h2 className="section-title mb-2">{roundLabel(round.slug, dict)}</h2>
                {round.groups ? (
                  <div className="space-y-4">
                    {round.groups.map((g) => (
                      <div key={g.name}>
                        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.name}</h3>
                        <div className="space-y-2">
                          {g.matches.map((m) => (
                            <MatchCard key={m.id} match={m} locale={locale} dict={dict} tz={tz} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {round.matches.map((m) => (
                      <MatchCard key={m.id} match={m} locale={locale} dict={dict} tz={tz} />
                    ))}
                  </div>
                )}
              </section>
            ))
          ) : (
            <EmptyState title={dict.common.noData} body={dict.tournaments.noMatches} />
          ))}
      </div>

      <p className="mt-6 text-xs text-slate-500">{dict.tournaments.dataNote}</p>
    </div>
  );
}

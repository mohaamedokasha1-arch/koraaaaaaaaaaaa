import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/locales';
import { getMatchMemo as getMatch, ServiceError } from '@/lib/football';
import type { MatchEvent, UnifiedMatch } from '@/lib/types';
import { TeamLogo } from '@/components/team-logo';
import { ErrorState, StaleNotice } from '@/components/empty-state';
import { formatFullDate, minuteLabel, num } from '@/lib/format';

export const dynamic = 'force-dynamic';

function titleOf(m: UnifiedMatch, dict: ReturnType<typeof getDictionary>) {
  return `${m.home.name} ${dict.common.versus} ${m.away.name}`;
}

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale; id: string };
}): Promise<Metadata> {
  const dict = getDictionary(params.locale);
  try {
    const result = await getMatch(params.id);
    if (!result) return { title: dict.match.matchDetails };
    const m = result.data;
    const title = titleOf(m, dict);
    return {
      title: `${title} - ${dict.match.matchDetails}`,
      description: `${title} | ${m.league.name} - ${dict.site.name}`,
      openGraph: { title: `${title} - ${dict.match.matchDetails}` },
    };
  } catch {
    return { title: dict.match.matchDetails };
  }
}

function eventIcon(type: MatchEvent['type']) {
  if (type === 'goal' || type === 'penalty_goal' || type === 'own_goal') return '⚽';
  if (type === 'yellow') return '🟨';
  if (type === 'red' || type === 'yellow_red') return '🟥';
  return '🔁';
}

function eventLabel(e: MatchEvent, dict: ReturnType<typeof getDictionary>) {
  const t = dict.match;
  switch (e.type) {
    case 'goal': return t.goal;
    case 'own_goal': return t.ownGoal;
    case 'penalty_goal': return `${t.goal} (${t.penalty})`;
    case 'yellow': return t.yellowCard;
    case 'red':
    case 'yellow_red': return t.redCard;
    case 'sub': return t.substitution;
  }
}

function EventsTimeline({ match, dict }: { match: UnifiedMatch; dict: ReturnType<typeof getDictionary> }) {
  if (match.events.length === 0) {
    return <p className="px-5 py-6 text-center text-sm text-slate-400">{dict.match.noEvents}</p>;
  }
  return (
    <ol className="divide-y divide-navy-800/70">
      {match.events.map((e, i) => {
        const isHome = e.teamId === match.home.id;
        const side = e.teamId ? (isHome ? match.home.name : match.away.name) : '';
        return (
          <li key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3">
            <span className="w-10 shrink-0 text-center text-sm font-bold text-slate-300 tabular-nums">
              {minuteLabel(e.minute, e.extraMinute)}
            </span>
            <span className="text-lg" aria-hidden="true">{eventIcon(e.type)}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                {eventLabel(e, dict)}
                {e.player ? ` — ${e.player}` : ''}
              </p>
              <p className="truncate text-xs text-slate-400">
                {e.type === 'sub'
                  ? [e.playerIn, e.playerOut ? `← ${e.playerOut}` : null].filter(Boolean).join('  ')
                  : [e.assist ? `↳ ${e.assist}` : null, side].filter(Boolean).join('  ·  ')}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-4 px-4 sm:px-5 py-3">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="text-sm font-medium text-slate-100 text-end">{value}</dd>
    </div>
  );
}

export default async function MatchPage({
  params,
}: {
  params: { locale: Locale; id: string };
}) {
  const { locale, id } = params;
  const dict = getDictionary(locale);

  let result = null;
  let failed = false;
  try {
    result = await getMatch(id);
  } catch (err) {
    if (!(err instanceof ServiceError)) failed = true;
  }

  if (!result && !failed) notFound();

  if (failed || !result) {
    return (
      <div className="container-page py-10">
        <ErrorState title={dict.common.errorTitle} body={dict.common.errorBody} />
      </div>
    );
  }

  const m = result.data;
  const played = m.status !== 'scheduled' && m.status !== 'postponed' && m.status !== 'cancelled';
  const title = titleOf(m, dict);
  const statusText =
    m.status === 'live'
      ? `${dict.match.statusLive} ${m.minute != null ? minuteLabel(m.minute) : ''}`.trim()
      : m.status === 'halftime'
        ? dict.match.statusHT
        : m.status === 'finished'
          ? dict.match.statusFT
          : m.status === 'postponed'
            ? dict.match.statusPostponed
            : m.status === 'cancelled'
              ? dict.match.statusCancelled
              : dict.match.statusScheduled;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: title,
    startDate: m.utcDate,
    url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/${locale}/matches/${m.id}`,
    homeTeam: { '@type': 'SportsTeam', name: m.home.name },
    awayTeam: { '@type': 'SportsTeam', name: m.away.name },
    sport: 'Soccer',
    location: m.venue ? { '@type': 'Place', name: m.venue } : undefined,
    organizer: { '@type': 'SportsOrganization', name: m.league.name },
  };

  return (
    <div className="container-page py-6 sm:py-8 space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="breadcrumb" className="text-xs text-slate-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href={`/${locale}`} className="hover:text-slate-300">{dict.nav.home}</Link></li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={m.league.code ? `/${locale}/leagues/${m.league.code}` : `/${locale}/leagues`}
              className="hover:text-slate-300"
            >
              {m.league.name}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-slate-300">{title}</li>
        </ol>
      </nav>

      {/* Score header */}
      <header className="card relative overflow-hidden px-4 sm:px-8 py-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(47,83,145,0.25),transparent_60%)]" />
        <div className="relative">
          <div className="mb-5 flex items-center justify-center gap-2 text-xs sm:text-sm text-slate-400">
            <TeamLogo src={m.league.emblem} alt={m.league.name} size={18} />
            <span>{m.league.name}</span>
            {m.matchday != null && (
              <span>· {dict.match.matchday} {num(m.matchday, locale)}</span>
            )}
          </div>

          <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <TeamLogo src={m.home.crest} alt={m.home.name} size={64} />
              <Link href={`/${locale}/teams/${m.home.id}`} className="text-sm sm:text-base font-bold text-white hover:text-navy-200">
                {m.home.name}
              </Link>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              {played ? (
                <div className="flex items-center gap-2 sm:gap-3 text-4xl sm:text-5xl font-extrabold tabular-nums text-white">
                  <span>{m.score.home ?? '–'}</span>
                  <span className="text-slate-600">-</span>
                  <span>{m.score.away ?? '–'}</span>
                </div>
              ) : (
                <time dateTime={m.utcDate} className="text-lg sm:text-2xl font-bold text-white">
                  {statusText}
                </time>
              )}
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                  m.status === 'live'
                    ? 'bg-red-500/15 text-red-400'
                    : m.status === 'halftime'
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-navy-700/80 text-slate-300'
                }`}
              >
                {m.status === 'live' && (
                  <span className="me-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulseDot" aria-hidden="true" />
                )}
                {statusText}
              </span>
              {played && (m.score.htHome != null || m.score.htAway != null) && (
                <span className="text-xs text-slate-500 tabular-nums">
                  {dict.match.statusHT} {m.score.htHome ?? '–'}-{m.score.htAway ?? '–'}
                </span>
              )}
              {m.score.pensHome != null && m.score.pensAway != null && (
                <span className="text-xs text-slate-500 tabular-nums">
                  {dict.match.penalty} {m.score.pensHome}-{m.score.pensAway}
                </span>
              )}
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <TeamLogo src={m.away.crest} alt={m.away.name} size={64} />
              <Link href={`/${locale}/teams/${m.away.id}`} className="text-sm sm:text-base font-bold text-white hover:text-navy-200">
                {m.away.name}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {result.stale && <StaleNotice message={dict.common.cachedNotice} />}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Events */}
        <section className="card overflow-hidden lg:col-span-3" aria-label={dict.match.events}>
          <h2 className="border-b border-navy-700 px-4 sm:px-5 py-3 text-base font-bold text-white">
            {dict.match.events}
          </h2>
          <EventsTimeline match={m} dict={dict} />
        </section>

        {/* Details */}
        <section className="card h-fit overflow-hidden lg:col-span-2" aria-label={dict.match.matchDetails}>
          <h2 className="border-b border-navy-700 px-4 sm:px-5 py-3 text-base font-bold text-white">
            {dict.match.matchDetails}
          </h2>
          <dl className="divide-y divide-navy-800/70">
            <InfoRow label={dict.match.competition} value={m.league.name} />
            <InfoRow label={dict.match.date} value={formatFullDate(m.utcDate, locale)} />
            {m.matchday != null && (
              <InfoRow label={dict.match.matchday} value={num(m.matchday, locale)} />
            )}
            <InfoRow label={dict.match.venue} value={m.venue} />
            <InfoRow label={dict.match.referee} value={m.referee} />
          </dl>
        </section>
      </div>
    </div>
  );
}

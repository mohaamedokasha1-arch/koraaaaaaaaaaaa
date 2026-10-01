import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, locales } from '@/i18n/locales';
import { pageMetadata } from '@/lib/seo';
import { LIVE_ENABLED } from '@/features/live/lib/config';
import { getLiveCatalog } from '@/features/live/lib/data';
import { nearbyMatchIds } from '@/features/live/lib/catalog';
import { liveMatchIdSchema } from '@/features/live/types';
import { getLiveCopy } from '@/features/live/lib/copy';
import { LiveMatchView } from '@/features/live/components/LiveMatchView';
import { LiveLegalLinks } from '@/features/live/components/LiveLegalLinks';

export const revalidate = 60;
export const dynamicParams = true;
export async function generateStaticParams() {
  const { catalog } = await getLiveCatalog();
  return locales.flatMap((locale) => nearbyMatchIds(catalog, Date.now()).map((matchId) => ({ locale, matchId })));
}
export async function generateMetadata({ params }: { params: Promise<{ locale: string; matchId: string }> }): Promise<Metadata> {
  const { locale, matchId } = await params;
  if (!isLocale(locale)) return {};
  const { catalog } = await getLiveCatalog();
  const match = catalog.matches.find((item) => item.matchId === matchId);
  const t = getLiveCopy(locale);
  return pageMetadata({ locale, path: `/watch/${encodeURIComponent(matchId)}`, title: match ? `${match.home.name} × ${match.away.name} · ${t.watch}` : t.title, description: t.description, indexable: LIVE_ENABLED && Boolean(match) });
}
export default async function BroadcastMatchPage({ params }: { params: Promise<{ locale: string; matchId: string }> }) {
  const { locale, matchId } = await params;
  if (!LIVE_ENABLED || !isLocale(locale) || !liveMatchIdSchema.safeParse(matchId).success) notFound();
  const { catalog, stale } = await getLiveCatalog();
  const match = catalog.matches.find((item) => item.matchId === matchId);
  if (!match) notFound();
  return <div className="container-page space-y-8 py-6 sm:py-8"><LiveMatchView initial={catalog} initialMatch={match} initialStale={stale} renderedAt={Date.now()} locale={locale} /><LiveLegalLinks locale={locale} /></div>;
}

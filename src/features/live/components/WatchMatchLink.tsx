'use client';

import Link from 'next/link';
import type { Locale } from '@/i18n/locales';
import bundled from '../../../../public/live/catalog.json';
import { emptyCatalog, liveCatalogSchema } from '../types/index.ts';
import { LIVE_ENABLED } from '../lib/config.ts';
import { hasMatchCoverage } from '../lib/catalog.ts';
import { getLiveCopy } from '../lib/copy.ts';
import { useLiveCatalog } from '../hooks/useLiveCatalog';
import { useLiveClock } from '../hooks/useLiveClock';
import { LiveIcon } from './LiveIcon';

const parsed = liveCatalogSchema.safeParse(bundled);
const initial = parsed.success ? parsed.data : emptyCatalog();

/** Separate sibling link: never nests an anchor inside the existing match card. */
export function WatchMatchLink({ matchId, locale }: { matchId: string; locale: Locale }) {
  const { catalog } = useLiveCatalog(initial);
  const now = useLiveClock() ?? 0;
  if (!LIVE_ENABLED || !hasMatchCoverage(catalog, matchId, now)) return null;
  return <Link href={`/${locale}/watch/${encodeURIComponent(matchId)}`} className="mt-2 inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/5 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"><LiveIcon name="play" className="h-3.5 w-3.5" />{getLiveCopy(locale).watch}</Link>;
}

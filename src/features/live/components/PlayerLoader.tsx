'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { StreamPlayerProps } from './StreamPlayer';
import { getLiveCopy } from '../lib/copy.ts';
import { LIVE_ENABLED } from '../lib/config.ts';
import { PlayerErrorBoundary } from './PlayerErrorBoundary';
import { PlayerSkeleton } from './PlayerSkeleton';
import { WhereToWatch } from './WhereToWatch';
import { LiveIcon } from './LiveIcon';

const LazyPlayer = dynamic(() => import('./StreamPlayer'), { ssr: false, loading: () => <div role="status" aria-label="Loading player" className="aspect-video animate-pulse rounded-xl border border-navy-700 bg-navy-900" /> });

export function PlayerLoader(props: StreamPlayerProps) {
  const [activated, setActivated] = useState(false);
  const t = getLiveCopy(props.locale);
  if (!LIVE_ENABLED) return null;
  if (!activated) return <div className="space-y-3"><button type="button" data-testid="load-player" onClick={() => setActivated(true)} className="group relative flex aspect-video w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-xl border border-navy-600 bg-navy-900 p-4 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300">
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 pitch-pattern opacity-[0.12]" /><span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.07),transparent_70%)]" />
    <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/50 bg-emerald-400/10 text-emerald-300 transition-transform group-hover:scale-105 sm:h-20 sm:w-20"><LiveIcon name="play" className="h-6 w-6 sm:h-8 sm:w-8" /></span>
    <span className="relative text-sm font-bold text-white sm:text-lg">{props.streams[0]?.provider === 'highlights' ? t.playHighlights : t.play}</span><span className="relative text-xs text-slate-400">{t.clickLoad}</span>
  </button><p className="text-[11px] leading-5 text-slate-400">{t.privacy}</p></div>;
  return <PlayerErrorBoundary locale={props.locale} fallback={<WhereToWatch broadcasters={props.broadcasters} externalStreams={props.externalStreams} locale={props.locale} />}>
    <LazyPlayer {...props} />
  </PlayerErrorBoundary>;
}

/** Small reserved-area placeholder is also used by the route loading boundary. */
export { PlayerSkeleton };

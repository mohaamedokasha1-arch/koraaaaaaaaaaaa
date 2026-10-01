'use client';

import { useRef, useState } from 'react';
import type { Locale } from '@/i18n/locales';
import type { Broadcaster, Stream } from '../types/index.ts';
import { getLiveCopy } from '../lib/copy.ts';
import { useStreamFallback } from '../hooks/useStreamFallback';
import { YouTubeAdapter } from '../adapters/youtube';
import { HlsAdapter } from '../adapters/hls';
import { TwitchAdapter } from '../adapters/twitch';
import { IframeAdapter } from '../adapters/iframe';
import { ServerSwitcher } from './ServerSwitcher';
import { ReportButton } from './ReportButton';
import { WhereToWatch } from './WhereToWatch';
import { LiveIcon } from './LiveIcon';

export interface StreamPlayerProps { matchId: string; streams: Stream[]; broadcasters: Broadcaster[]; externalStreams: Stream[]; title: string; locale: Locale }

export default function StreamPlayer({ matchId, streams, broadcasters, externalStreams, title, locale }: StreamPlayerProps) {
  const { state, current, token, events, select, next, retry } = useStreamFallback(matchId, streams);
  const frame = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState('');
  const t = getLiveCopy(locale);
  const manual = current?.provider === 'iframe' || current?.provider === 'twitch' || (current?.provider === 'highlights' && current.embedProvider === 'scorebat');
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (frame.current?.requestFullscreen) await frame.current.requestFullscreen();
      else setNotice(t.fullscreenError);
    } catch { setNotice(t.fullscreenError); }
  }
  const props = current ? { stream: current, title, ...events } : null;
  let adapter = null;
  if (props && state.phase !== 'idle' && state.phase !== 'exhausted') {
    if (current?.provider === 'youtube' || (current?.provider === 'highlights' && current.embedProvider === 'youtube')) adapter = <YouTubeAdapter key={token} {...props} />;
    else if (current?.provider === 'hls') adapter = <HlsAdapter key={token} {...props} />;
    else if (current?.provider === 'twitch') adapter = <TwitchAdapter key={token} {...props} />;
    else adapter = <IframeAdapter key={token} {...props} />;
  }
  return <div className="space-y-4" data-testid="stream-player">
    {state.phase === 'exhausted' ? <>
      <div role="alert" className="card flex min-h-[250px] flex-col items-center justify-center px-5 py-8 text-center"><LiveIcon name="report" className="mb-4 h-8 w-8 text-amber-300" /><h2 className="text-lg font-bold text-white">{t.exhausted}</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{t.exhaustedBody}</p><button type="button" className="btn-ghost mt-4" onClick={retry}><LiveIcon name="refresh" className="h-4 w-4" />{t.retry}</button></div>
      <WhereToWatch broadcasters={broadcasters} externalStreams={externalStreams} locale={locale} />
    </> : <div ref={frame} className="relative aspect-video overflow-hidden rounded-xl border border-navy-600 bg-black" data-testid="player-frame">
      {adapter}
      {(state.phase === 'loading' || state.phase === 'idle') && <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center bg-navy-950/85"><span className="flex animate-pulse items-center gap-2 text-sm text-slate-300"><LiveIcon name="tv" />{t.loading}</span></div>}
    </div>}
    <div role="status" aria-live="polite" className="min-h-[20px] text-xs text-amber-200">{state.phase === 'loading' && state.switched && current ? `${t.switching} ${current.label}…` : notice}</div>
    <ServerSwitcher streams={state.streams} currentId={state.currentId} health={state.health} attempts={state.attempts} onSelect={select} locale={locale} />
    {state.phase !== 'exhausted' && current && <>
      <div className="flex flex-wrap items-start gap-2"><button type="button" onClick={next} className="btn-ghost !text-xs"><LiveIcon name="refresh" className="h-4 w-4" />{t.next}</button><button type="button" onClick={fullscreen} className="btn-ghost !text-xs"><LiveIcon name="fullscreen" className="h-4 w-4" />{t.fullscreen}</button><ReportButton key={current.id} matchId={matchId} streamId={current.id} locale={locale} /></div>
      {manual && <div className="rounded-lg border border-navy-700 bg-navy-900/50 p-4"><p className="text-xs leading-6 text-slate-400">{t.iframeNotice}</p><div className="mt-3 flex gap-2"><button type="button" className="btn-ghost !min-h-[36px] !py-1.5 !text-xs" onClick={events.onWorking}><LiveIcon name="check" className="h-4 w-4" />{t.works}</button><button type="button" className="btn-ghost !min-h-[36px] !py-1.5 !text-xs" onClick={events.onFailure}>{t.doesNotWork}</button></div></div>}
      {current.region.length > 0 && <p className="text-xs text-slate-400">{t.region}: {current.region.join(', ')}</p>}
    </>}
  </div>;
}

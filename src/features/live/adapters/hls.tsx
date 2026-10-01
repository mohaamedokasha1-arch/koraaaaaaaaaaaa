'use client';

import { useEffect, useRef } from 'react';
import type Hls from 'hls.js';
import type { AdapterProps } from './types';
import { approvedUrl, livePolicy } from '../lib/policy.mjs';

export function HlsAdapter({ stream, title, onLoaded, onWorking, onSlow, onFailure }: AdapterProps) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let cancelled = false;
    let hls: Hls | null = null;
    let recovered = false;
    let firstFragment = true;
    let firstFragmentAt: number | null = null;
    let waitingTimer: ReturnType<typeof setTimeout> | undefined;
    let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
    const fail = () => { if (!cancelled) onFailure(); };
    const startupTimer = setTimeout(fail, 20_000);
    const loaded = () => { clearTimeout(startupTimer); onLoaded(); };
    const working = () => { clearTimeout(waitingTimer); clearTimeout(recoveryTimer); onWorking(); };
    const waiting = () => { clearTimeout(waitingTimer); waitingTimer = setTimeout(() => { if (!cancelled && !video.paused) onSlow(); }, 4000); };
    const canPlay = () => { clearTimeout(recoveryTimer); };
    const play = () => { void video.play().catch(() => { /* Autoplay denial is not a failed server. Native controls remain available. */ }); };
    video.addEventListener('loadedmetadata', loaded); video.addEventListener('playing', working);
    video.addEventListener('waiting', waiting); video.addEventListener('canplay', canPlay); video.addEventListener('error', fail);
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = stream.sourceRef; play();
    } else {
      // This is the ONLY runtime import of hls.js. YouTube/iframe visitors never download it.
      void import('hls.js').then(({ default: HlsClient }) => {
        if (cancelled) return;
        if (!HlsClient.isSupported()) { fail(); return; }
        hls = new HlsClient({
          maxBufferLength: 30,
          xhrSetup: (_xhr, url) => {
            if (!approvedUrl(url, [...livePolicy.hlsHosts, ...livePolicy.mediaHosts])) throw new Error('Unapproved media CDN');
          },
        });
        hls.on(HlsClient.Events.MANIFEST_PARSED, () => { if (!cancelled) { loaded(); play(); } });
        hls.on(HlsClient.Events.FRAG_LOADING, () => { if (firstFragment && firstFragmentAt === null) firstFragmentAt = performance.now(); });
        hls.on(HlsClient.Events.FRAG_LOADED, () => {
          if (cancelled) return;
          if (firstFragment && firstFragmentAt !== null && performance.now() - firstFragmentAt > 4000) onSlow();
          firstFragment = false;
          if (!video.paused && video.buffered.length && video.buffered.end(video.buffered.length - 1) - video.currentTime < 2) onSlow();
        });
        hls.on(HlsClient.Events.ERROR, (_event, data) => {
          if (cancelled || !data.fatal) return;
          if (data.type === HlsClient.ErrorTypes.MEDIA_ERROR && !recovered) {
            recovered = true; hls?.recoverMediaError(); recoveryTimer = setTimeout(fail, 10_000);
          } else fail();
        });
        hls.loadSource(stream.sourceRef); hls.attachMedia(video);
      }).catch(fail);
    }
    return () => {
      cancelled = true; clearTimeout(startupTimer); clearTimeout(waitingTimer); clearTimeout(recoveryTimer);
      video.removeEventListener('loadedmetadata', loaded); video.removeEventListener('playing', working);
      video.removeEventListener('waiting', waiting); video.removeEventListener('canplay', canPlay); video.removeEventListener('error', fail);
      hls?.destroy(); video.pause(); video.removeAttribute('src'); video.load();
    };
  }, [stream.sourceRef, onLoaded, onWorking, onSlow, onFailure]);
  return <video ref={ref} title={title} controls autoPlay playsInline preload="metadata" className="absolute inset-0 h-full w-full bg-black" />;
}

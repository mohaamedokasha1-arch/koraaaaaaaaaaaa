'use client';

import { useEffect, useRef, useState } from 'react';
import type { AdapterProps } from './types';
import { loadYouTubeApi } from './youtube-api';
import { youtubeEmbedUrl } from './urls.ts';

export function YouTubeAdapter({ stream, title, onLoaded, onWorking, onSlow, onFailure }: AdapterProps) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => {
    if (!origin || !iframe.current) return;
    let cancelled = false;
    let player: { destroy: () => void } | undefined;
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    let buffering: number[] = [];
    const fail = () => { if (!cancelled) onFailure(); };
    readyTimer = setTimeout(fail, 12_000);
    void loadYouTubeApi().then((api) => {
      if (cancelled || !iframe.current) return;
      player = new api.Player(iframe.current, {
        events: {
          onReady: (event) => {
            if (cancelled) return;
            clearTimeout(readyTimer); onLoaded(); event.target.playVideo();
          },
          onError: fail,
          onStateChange: ({ data }) => {
            if (cancelled) return;
            if (data === 1) onWorking();
            if (data === 0 && stream.provider === 'youtube') onFailure(); // a live source ended; finished highlights are not a failure
            if (data === 3) {
              const now = performance.now(); buffering = [...buffering.filter((at) => now - at < 90_000), now];
              if (buffering.length >= 3) onSlow();
            }
          },
        },
      });
    }).catch(fail);
    return () => { cancelled = true; clearTimeout(readyTimer); player?.destroy(); };
  }, [origin, stream.sourceRef, stream.provider, onLoaded, onWorking, onSlow, onFailure]);
  if (!origin) return null;
  return <iframe ref={iframe} src={youtubeEmbedUrl(stream.sourceRef, origin)} title={title} className="absolute inset-0 h-full w-full border-0"
    sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="strict-origin-when-cross-origin"
    allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />;
}

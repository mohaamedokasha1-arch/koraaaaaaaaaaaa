'use client';

import { useEffect, useRef } from 'react';
import type { AdapterProps } from './types';
import { IFRAME_TIMEOUT_MS } from '../lib/config.ts';

/** Cross-origin load is not playback success. Confirmation remains manual. */
export function IframeAdapter({ stream, title, onLoaded, onFailure }: AdapterProps) {
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!loaded.current) timer.current = setTimeout(onFailure, IFRAME_TIMEOUT_MS);
    return () => clearTimeout(timer.current);
  }, [onFailure]);
  return <iframe src={stream.sourceRef} title={title} className="absolute inset-0 h-full w-full border-0" loading="eager"
    sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="strict-origin-when-cross-origin"
    allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen
    onLoad={() => { loaded.current = true; clearTimeout(timer.current); onLoaded(); }} onError={onFailure} />;
}

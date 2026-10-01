'use client';

import { useEffect, useState } from 'react';
import type { AdapterProps } from './types';
import { IframeAdapter } from './iframe';
import { twitchEmbedUrl } from './urls.ts';

export function TwitchAdapter(props: AdapterProps) {
  const [hostname, setHostname] = useState<string | null>(null);
  useEffect(() => { setHostname(window.location.hostname); }, []);
  if (!hostname) return null;
  // The real browser hostname is required by Twitch, including Arena previews.
  return <IframeAdapter {...props} stream={{ ...props.stream, sourceRef: twitchEmbedUrl(props.stream.sourceRef, hostname) }} />;
}

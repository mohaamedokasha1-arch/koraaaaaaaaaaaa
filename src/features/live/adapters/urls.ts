import type { Stream } from '../types/index.ts';
import { approvedUrl, isTwitchChannel, isYouTubeId, livePolicy } from '../lib/policy.mjs';

export function youtubeEmbedUrl(videoId: string, origin: string): string {
  if (!isYouTubeId(videoId)) throw new Error('Invalid YouTube video');
  const url = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
  url.search = new URLSearchParams({ enablejsapi: '1', origin: new URL(origin).origin, autoplay: '1', playsinline: '1', rel: '0' }).toString();
  return url.toString();
}
export function twitchEmbedUrl(channel: string, hostname: string): string {
  if (!isTwitchChannel(channel) || !hostname || /[/?#:]/.test(hostname)) throw new Error('Invalid Twitch embed');
  const url = new URL('https://player.twitch.tv/');
  url.search = new URLSearchParams({ channel, parent: hostname, autoplay: 'true' }).toString();
  return url.toString();
}

/** A reviewed embed may still work on the official platform when embedding fails. */
export function officialSourceUrl(stream: Stream): string | null {
  if ((stream.provider === 'youtube' || (stream.provider === 'highlights' && stream.embedProvider === 'youtube')) && isYouTubeId(stream.sourceRef)) return `https://www.youtube.com/watch?v=${stream.sourceRef}`;
  if (stream.provider === 'twitch' && isTwitchChannel(stream.sourceRef)) return `https://www.twitch.tv/${stream.sourceRef}`;
  if (stream.provider === 'external' && approvedUrl(stream.sourceRef, livePolicy.externalHosts)) return stream.sourceRef;
  if ((stream.provider === 'iframe' || (stream.provider === 'highlights' && stream.embedProvider === 'scorebat')) && approvedUrl(stream.sourceRef, livePolicy.iframeHosts)) return stream.sourceRef;
  return null; // A licensed manifest is never presented as a broadcaster webpage.
}

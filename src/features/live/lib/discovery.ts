import type { LiveCatalog, OfficialChannel, Stream } from '../types/index.ts';
import { scorebatUrl } from './policy.mjs';
import type { Discovery, YouTubeVideo } from '../types/discovery.ts';

export const YOUTUBE_SEARCH_COST = 100;
export const YOUTUBE_DAILY_SCHEDULED_SEARCHES = 96;

/** Exactly ONE search per 15-minute slot, not 96 searches per channel per day. */
export function channelForSlot(channels: OfficialChannel[], now: number): OfficialChannel | null {
  const enabled = channels.filter((channel) => channel.enabled);
  return enabled[Math.floor(now / (15 * 60 * 1000)) % enabled.length] ?? null;
}

export function youtubeCandidate(video: YouTubeVideo, channel: OfficialChannel, now: string): Discovery | null {
  if (video.snippet.channelId !== channel.id || video.status.privacyStatus !== 'public') return null;
  if (video.snippet.liveBroadcastContent === 'none' && !video.liveStreamingDetails?.actualEndTime) return null;
  return {
    provider: 'youtube', sourceRef: video.id, title: video.snippet.title, channelId: channel.id, channelName: channel.name,
    status: video.liveStreamingDetails?.actualEndTime ? 'ended' : video.snippet.liveBroadcastContent === 'live' ? 'live' : 'scheduled',
    startsAt: video.liveStreamingDetails?.actualStartTime ?? video.liveStreamingDetails?.scheduledStartTime ?? null,
    embeddable: video.status.embeddable, discoveredAt: now,
  };
}

/** Only update a video already attached by an operator. Never guess match IDs. */
export function applyYouTubeMetadata(catalog: LiveCatalog, videos: YouTubeVideo[], queriedIds: string[], channels: OfficialChannel[], now: string): LiveCatalog {
  const approved = new Set(channels.filter((channel) => channel.enabled).map((channel) => channel.id));
  const queried = new Set(queriedIds); const byId = new Map(videos.map((video) => [video.id, video]));
  let changed = false;
  const streams = catalog.streams.map((stream): Stream => {
    if (stream.provider !== 'youtube' || !queried.has(stream.sourceRef)) return stream;
    const video = byId.get(stream.sourceRef);
    let next: Stream;
    if (!video || !stream.channelId || !approved.has(stream.channelId) || video.snippet.channelId !== stream.channelId || !video.status.embeddable || video.status.privacyStatus !== 'public') {
      next = { ...stream, status: 'failed' };
    } else {
      next = {
        ...stream,
        status: video.liveStreamingDetails?.actualEndTime ? 'ended' : video.snippet.liveBroadcastContent === 'live' ? 'live' : video.snippet.liveBroadcastContent === 'upcoming' ? 'scheduled' : 'failed',
        startsAt: video.liveStreamingDetails?.actualStartTime ?? video.liveStreamingDetails?.scheduledStartTime ?? stream.startsAt,
        endsAt: video.liveStreamingDetails?.actualEndTime ?? stream.endsAt,
      };
    }
    if (JSON.stringify(stream) !== JSON.stringify(next)) changed = true;
    return next;
  });
  return changed ? { ...catalog, streams, updatedAt: now } : catalog;
}

/** Extract only an approved URL from the documented API, not raw embed HTML. */
export function scorebatEmbedFromApi(embed: string): string | null {
  const match = embed.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i);
  if (!match) return null;
  try {
    const url = new URL(match[1].replace(/&amp;/g, '&'));
    // API access tokens and publisher tracking parameters never enter our JSON.
    url.search = ''; url.hash = '';
    return scorebatUrl(url.toString()) ? url.toString() : null;
  } catch { return null; }
}

export function mergeDiscoveries(previous: Discovery[], incoming: Discovery[], now: number): Discovery[] {
  const recent = previous.filter((item) => now - Date.parse(item.discoveredAt) <= 7 * 24 * 60 * 60 * 1000);
  return Array.from(new Map([...recent, ...incoming].map((item) => [`${item.provider}:${item.sourceRef}`, item])).values())
    .sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt)).slice(0, 300);
}

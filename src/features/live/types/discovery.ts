import { array as zArray, boolean as zBoolean, discriminatedUnion as zDiscriminatedUnion, enum as zEnum, literal as zLiteral, object as zObject, string as zString } from 'zod';
import type { z } from 'zod';
import { scorebatUrl } from '../lib/policy.mjs';

const instant = zString().datetime({ offset: true });
export const youtubeSearchSchema = zObject({
  items: zArray(zObject({ id: zObject({ videoId: zString().regex(/^[a-zA-Z0-9_-]{11}$/) }) })).max(50),
});
export const youtubeVideosSchema = zObject({
  items: zArray(zObject({
    id: zString().regex(/^[a-zA-Z0-9_-]{11}$/),
    snippet: zObject({ channelId: zString().regex(/^UC[a-zA-Z0-9_-]{22}$/), title: zString().max(500), liveBroadcastContent: zEnum(['live', 'upcoming', 'none']) }),
    status: zObject({ embeddable: zBoolean(), privacyStatus: zEnum(['public', 'unlisted', 'private']) }),
    liveStreamingDetails: zObject({ actualStartTime: instant.optional(), actualEndTime: instant.optional(), scheduledStartTime: instant.optional() }).optional(),
  })).max(50),
});
export const scorebatFeedSchema = zObject({
  response: zArray(zObject({
    title: zString().max(500), date: instant.optional(),
    competition: zString().max(180).optional(),
    videos: zArray(zObject({ title: zString().max(500), embed: zString().max(20_000) })).max(30),
  })).max(300),
});
const candidateBase = { title: zString().max(500), discoveredAt: instant, startsAt: instant.nullable() };
export const discoverySchema = zDiscriminatedUnion('provider', [
  zObject({ ...candidateBase, provider: zLiteral('youtube'), sourceRef: zString().regex(/^[a-zA-Z0-9_-]{11}$/), channelId: zString().regex(/^UC[a-zA-Z0-9_-]{22}$/), channelName: zString().max(180), status: zEnum(['scheduled', 'live', 'ended']), embeddable: zBoolean() }).strict(),
  zObject({ ...candidateBase, provider: zLiteral('scorebat'), sourceRef: zString().max(2048).refine(scorebatUrl), competition: zString().max(180) }).strict(),
]);
export const discoveriesSchema = zObject({ updatedAt: instant.nullable(), candidates: zArray(discoverySchema).max(300) }).strict();
export type Discovery = z.infer<typeof discoverySchema>;
export type Discoveries = z.infer<typeof discoveriesSchema>;
export type YouTubeVideo = z.infer<typeof youtubeVideosSchema>['items'][number];

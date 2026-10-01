import { array as zArray, boolean as zBoolean, enum as zEnum, literal as zLiteral, number as zNumber, object as zObject, string as zString } from 'zod';
import type { z } from 'zod';
import { approvedUrl, isTwitchChannel, isYouTubeId, livePolicy, scorebatUrl, secureUrl } from '../lib/policy.mjs';

export const liveIdSchema = zString().min(1).max(120).regex(/^[a-zA-Z0-9_~.:-]+$/);
const text = zString().trim().min(1).max(180);
const instant = zString().datetime({ offset: true });
const httpsUrl = zString().max(2048).refine((value) => Boolean(secureUrl(value)), 'A public HTTPS URL is required');
const outboundUrl = httpsUrl.refine((value) => approvedUrl(value, livePolicy.externalHosts), 'Unapproved official platform host');
const region = zArray(zString().regex(/^[A-Z]{2}$/)).max(100).default([]);

export const rightsSchema = zObject({
  basis: zEnum(['official', 'licensed']),
  referenceUrl: httpsUrl,
  verifiedAt: instant,
  verifiedBy: text,
}).strict();

const teamSchema = zObject({
  id: liveIdSchema,
  name: text,
  crest: httpsUrl.nullable().default(null),
}).strict();

/** A read-only fixture reference, not a replacement for the scores data model. */
export const liveMatchSchema = zObject({
  matchId: liveIdSchema,
  home: teamSchema,
  away: teamSchema,
  competition: zObject({ id: liveIdSchema, name: text, code: liveIdSchema.nullable().default(null) }).strict(),
  startsAt: instant,
  endsAt: instant.nullable().default(null),
  status: zEnum(['scheduled', 'live', 'ended']),
}).strict().superRefine((match, ctx) => {
  if (match.home.id === match.away.id) ctx.addIssue({ code: 'custom', message: 'Teams must be different', path: ['away', 'id'] });
  if (match.endsAt && Date.parse(match.endsAt) <= Date.parse(match.startsAt)) ctx.addIssue({ code: 'custom', message: 'End must follow kickoff', path: ['endsAt'] });
});

export const streamSchema = zObject({
  id: liveIdSchema,
  matchId: liveIdSchema,
  label: text,
  provider: zEnum(['youtube', 'twitch', 'hls', 'iframe', 'external', 'highlights']),
  sourceRef: zString().min(1).max(2048),
  channelId: zString().regex(/^UC[a-zA-Z0-9_-]{22}$/).optional(),
  embedProvider: zEnum(['youtube', 'scorebat']).optional(),
  priority: zNumber().int().min(0).max(1000),
  language: zString().min(2).max(40),
  quality: zEnum(['HD', 'SD', 'auto']),
  region,
  isOfficial: zBoolean(),
  rights: rightsSchema,
  status: zEnum(['scheduled', 'live', 'ended', 'failed']),
  startsAt: instant,
  endsAt: instant.nullable().default(null),
  reportCount: zNumber().int().min(0).max(1_000_000).default(0),
  hiddenUntil: instant.nullable().default(null),
}).strict().superRefine((stream, ctx) => {
  const bad = (message: string, path = 'sourceRef') => ctx.addIssue({ code: 'custom', message, path: [path] });
  if (!stream.isOfficial && stream.rights.basis !== 'licensed') bad('Non-official sources require a verified licence', 'rights');
  if (stream.provider === 'youtube' || (stream.provider === 'highlights' && stream.embedProvider === 'youtube')) {
    if (!isYouTubeId(stream.sourceRef)) bad('Use a YouTube video id, not an arbitrary URL');
    if (!stream.channelId) bad('A reviewed official channel id is required', 'channelId');
  }
  if (stream.provider === 'twitch' && !isTwitchChannel(stream.sourceRef)) bad('Invalid Twitch channel name');
  if (stream.provider === 'hls') {
    if (!approvedUrl(stream.sourceRef, livePolicy.hlsHosts)) bad('HLS manifest host has not been licensed/approved');
    else if (!new URL(stream.sourceRef).pathname.toLowerCase().endsWith('.m3u8')) bad('Expected an HLS manifest');
  }
  if (stream.provider === 'iframe' && !approvedUrl(stream.sourceRef, livePolicy.iframeHosts)) bad('Unapproved embed host');
  if (stream.provider === 'iframe' && secureUrl(stream.sourceRef)?.hostname === 'www.scorebat.com' && !scorebatUrl(stream.sourceRef)) bad('Use a documented Scorebat embed URL');
  if (stream.provider === 'external' && !approvedUrl(stream.sourceRef, livePolicy.externalHosts)) bad('Unapproved official platform link');
  if (stream.provider === 'highlights') {
    if (!stream.embedProvider) bad('Specify youtube or scorebat for licensed highlights', 'embedProvider');
    if (stream.embedProvider === 'scorebat' && !scorebatUrl(stream.sourceRef)) bad('Invalid Scorebat embed URL');
  }
  if (stream.endsAt && Date.parse(stream.endsAt) <= Date.parse(stream.startsAt)) bad('End must follow start', 'endsAt');
});

export const broadcasterSchema = zObject({
  id: liveIdSchema,
  name: text,
  competitionIds: zArray(liveIdSchema).min(1).max(100),
  url: outboundUrl,
  region,
  note: zString().max(300).default(''),
  rights: rightsSchema,
}).strict();

export const liveCatalogSchema = zObject({
  version: zLiteral(1),
  revision: zNumber().int().min(0).default(0),
  updatedAt: instant.nullable(),
  matches: zArray(liveMatchSchema).max(500),
  streams: zArray(streamSchema).max(2000),
  broadcasters: zArray(broadcasterSchema).max(200),
}).strict().superRefine((catalog, ctx) => {
  for (const [key, ids] of [
    ['matches', catalog.matches.map((match) => match.matchId)],
    ['streams', catalog.streams.map((stream) => stream.id)],
    ['broadcasters', catalog.broadcasters.map((broadcaster) => broadcaster.id)],
  ] as const) {
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: `Duplicate ${key} identifiers`, path: [key] });
  }
  const matches = new Set(catalog.matches.map((match) => match.matchId));
  catalog.streams.forEach((stream, index) => {
    if (!matches.has(stream.matchId)) ctx.addIssue({ code: 'custom', message: 'Unknown matchId', path: ['streams', index, 'matchId'] });
  });
});

export const officialChannelsSchema = zArray(zObject({
  id: zString().regex(/^UC[a-zA-Z0-9_-]{22}$/),
  name: text,
  officialUrl: httpsUrl.refine((value) => secureUrl(value)?.hostname === 'www.youtube.com', 'Use the official YouTube channel URL'),
  enabled: zBoolean(),
  rights: rightsSchema,
}).strict()).max(100).superRefine((channels, ctx) => {
  if (new Set(channels.map((channel) => channel.id)).size !== channels.length) ctx.addIssue({ code: 'custom', message: 'Duplicate channel ids' });
});

export const reportSchema = zObject({ matchId: liveIdSchema, streamId: liveIdSchema }).strict();
export const catalogRowsSchema = zArray(zObject({ document: liveCatalogSchema })).max(1);

export type LiveCatalog = z.infer<typeof liveCatalogSchema>;
export type LiveMatch = z.infer<typeof liveMatchSchema>;
export type Stream = z.infer<typeof streamSchema>;
export type Broadcaster = z.infer<typeof broadcasterSchema>;
export type OfficialChannel = z.infer<typeof officialChannelsSchema>[number];

export function emptyCatalog(): LiveCatalog {
  return { version: 1, revision: 0, updatedAt: null, matches: [], streams: [], broadcasters: [] };
}

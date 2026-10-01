import type { LiveCatalog, OfficialChannel } from '../types/index.ts';

/** Discovery must never turn an arbitrary YouTube upload into an official stream. */
export function catalogChannelIssues(catalog: LiveCatalog, channels: OfficialChannel[]): string[] {
  const approved = new Set(channels.filter((channel) => channel.enabled).map((channel) => channel.id));
  return catalog.streams.flatMap((stream, index) => {
    const youtube = stream.provider === 'youtube' || (stream.provider === 'highlights' && stream.embedProvider === 'youtube');
    return youtube && (!stream.channelId || !approved.has(stream.channelId)) ? [`streams.${index}.channelId: channel is not in the enabled official whitelist`] : [];
  });
}

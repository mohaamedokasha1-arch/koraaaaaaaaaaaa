import type { Broadcaster, LiveCatalog, LiveMatch, Stream } from '../types/index.ts';

export function streamsForMatch(catalog: LiveCatalog, matchId: string): Stream[] {
  return catalog.streams.filter((stream) => stream.matchId === matchId).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

export function isStreamVisible(stream: Stream, now: number): boolean {
  return stream.status !== 'failed' && (!stream.hiddenUntil || Date.parse(stream.hiddenUntil) <= now);
}

/** An elapsed scheduled kickoff is NOT evidence that a source is broadcasting. */
export function playableStreams(catalog: LiveCatalog, match: LiveMatch, now: number): Stream[] {
  return streamsForMatch(catalog, match.matchId).filter((stream) => {
    if (!isStreamVisible(stream, now) || stream.provider === 'external') return false;
    if (match.status === 'ended') return stream.provider === 'highlights' && stream.status === 'ended';
    return stream.provider !== 'highlights' && stream.status === 'live' && (!stream.endsAt || Date.parse(stream.endsAt) > now);
  });
}

export function broadcastersForMatch(catalog: LiveCatalog, match: LiveMatch): Broadcaster[] {
  return catalog.broadcasters.filter((item) => item.competitionIds.includes(match.competition.id) || Boolean(match.competition.code && item.competitionIds.includes(match.competition.code)));
}

/** Watch buttons include verified external-only coverage as well as embeds. */
export function hasMatchCoverage(catalog: LiveCatalog, matchId: string, now: number): boolean {
  const match = catalog.matches.find((item) => item.matchId === matchId);
  return Boolean(match && (streamsForMatch(catalog, matchId).some((stream) => isStreamVisible(stream, now) && (match.status !== 'ended' || stream.provider === 'highlights' || stream.provider === 'external')) || broadcastersForMatch(catalog, match).length));
}

export function nearbyMatchIds(catalog: LiveCatalog, now: number): string[] {
  const week = 7 * 24 * 60 * 60 * 1000;
  return catalog.matches.filter((match) => Math.abs(Date.parse(match.startsAt) - now) <= week).slice(0, 100).map((match) => match.matchId);
}

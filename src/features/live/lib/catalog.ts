import type { Broadcaster, LiveCatalog, LiveMatch, Stream } from '../types/index.ts';

export function streamsForMatch(catalog: LiveCatalog, matchId: string): Stream[] {
  return catalog.streams.filter((stream) => stream.matchId === matchId).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

export function isStreamVisible(stream: Stream, now: number): boolean {
  return stream.status !== 'failed' && (!stream.hiddenUntil || Date.parse(stream.hiddenUntil) <= now);
}

/**
 * Reviewed coverage, not a playback/region guarantee. Keep scheduled sources
 * for upcoming watch pages and official external pages for possible replays.
 * An ended live video is not automatically a licensed highlights entry.
 */
export function coverageStreams(catalog: LiveCatalog, match: LiveMatch, now: number): Stream[] {
  return streamsForMatch(catalog, match.matchId).filter((stream) => {
    if (!isStreamVisible(stream, now)) return false;
    if (stream.provider === 'external') return true;
    if (match.status === 'ended') return stream.provider === 'highlights' && stream.status === 'ended';
    if (stream.provider === 'highlights' || stream.status === 'ended') return false;
    if (stream.endsAt && Date.parse(stream.endsAt) <= now) return false;
    return stream.status === 'scheduled' || (stream.status === 'live' && Date.parse(stream.startsAt) <= now);
  });
}

/** An elapsed scheduled kickoff is NOT evidence that a source is broadcasting. */
export function playableStreams(catalog: LiveCatalog, match: LiveMatch, now: number): Stream[] {
  return coverageStreams(catalog, match, now).filter((stream) => stream.provider !== 'external'
    && (match.status === 'ended' ? stream.provider === 'highlights' : stream.status === 'live'));
}

export function broadcastersForMatch(catalog: LiveCatalog, match: LiveMatch): Broadcaster[] {
  return catalog.broadcasters.filter((item) => item.competitionIds.includes(match.competition.id) || Boolean(match.competition.code && item.competitionIds.includes(match.competition.code)));
}

/** Watch buttons include verified external-only coverage as well as embeds. */
export function hasMatchCoverage(catalog: LiveCatalog, matchId: string, now: number): boolean {
  const match = catalog.matches.find((item) => item.matchId === matchId);
  return Boolean(match && (coverageStreams(catalog, match, now).length || broadcastersForMatch(catalog, match).length));
}

export function nearbyMatchIds(catalog: LiveCatalog, now: number): string[] {
  const week = 7 * 24 * 60 * 60 * 1000;
  return catalog.matches.filter((match) => Math.abs(Date.parse(match.startsAt) - now) <= week).slice(0, 100).map((match) => match.matchId);
}

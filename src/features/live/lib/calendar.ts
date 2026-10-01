import type { LiveMatch } from '../types/index.ts';

function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}
function foldLine(line: string): string {
  const encoder = new TextEncoder(); let result = ''; let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).byteLength;
    if (bytes + size > 75) { result += '\r\n '; bytes = 1; }
    result += character; bytes += size;
  }
  return result;
}
function utcStamp(value: string): string { return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); }

export function matchCalendar(match: LiveMatch, pageUrl: string, now: string): string {
  // Two hours is a calendar reservation, never an invented match end time.
  const end = match.endsAt ?? new Date(Date.parse(match.startsAt) + 2 * 60 * 60 * 1000).toISOString();
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KoraScore//Official Broadcast Centre//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${escapeIcs(match.matchId)}@korascore`, `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(match.startsAt)}`, `DTEND:${utcStamp(end)}`,
    `SUMMARY:${escapeIcs(`${match.home.name} vs ${match.away.name}`)}`,
    `DESCRIPTION:${escapeIcs(`${match.competition.name}\n${pageUrl}\nCheck official broadcast availability in your country.`)}`,
    `URL:${escapeIcs(pageUrl)}`, 'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:Match reminder', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].map(foldLine).join('\r\n');
}

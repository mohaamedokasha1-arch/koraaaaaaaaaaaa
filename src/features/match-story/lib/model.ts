import type { MatchEvent, UnifiedMatch } from '../../../lib/types';

/** Presentation-only keys/segments: never manufacture provider entity IDs. */
export const MAX_STORY_EVENTS = 300;
export const STORY_PAGE_SIZE = 40;
export const STORY_SEGMENTS = ['all', 'first', 'second', 'later', 'unknown'] as const;
export type StorySegment = (typeof STORY_SEGMENTS)[number];
export type StoryEvent = MatchEvent & { key: string; side: 'home' | 'away' | 'unknown'; segment: Exclude<StorySegment, 'all'> };
const TYPES = new Set<MatchEvent['type']>(['goal', 'own_goal', 'penalty_goal', 'yellow', 'red', 'yellow_red', 'sub']);

export function storyText(value: unknown, max = 160): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
  return clean ? Array.from(clean).slice(0, max).join('') : null;
}
function boundedMinute(value: unknown, max = 200): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : null;
}
export function eventSegment(minute: number | null): Exclude<StorySegment, 'all'> {
  if (minute === null) return 'unknown';
  if (minute <= 45) return 'first';
  if (minute <= 90) return 'second';
  return 'later';
}
export function eventMinute(event: Pick<MatchEvent, 'minute' | 'extraMinute'>): string | null {
  const minute = boundedMinute(event.minute);
  if (minute === null) return null;
  const extra = boundedMinute(event.extraMinute, 60);
  return `${minute}${extra ? `+${extra}` : ''}′`;
}
export function isGoal(event: Pick<MatchEvent, 'type'>): boolean {
  return event.type === 'goal' || event.type === 'own_goal' || event.type === 'penalty_goal';
}
export function isHighlight(event: Pick<MatchEvent, 'type'>): boolean {
  return isGoal(event) || event.type === 'red' || event.type === 'yellow_red';
}
function fingerprint(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

/** Never derive a score, side, phase, clock or statistical total from events. */
export function buildStory(match: Pick<UnifiedMatch, 'events' | 'home' | 'away'>) {
  const raw: unknown[] = Array.isArray(match.events) ? match.events : [];
  const occurrences = new Map<string, number>();
  const events: StoryEvent[] = [];
  let skipped = 0;
  for (const value of raw.slice(0, MAX_STORY_EVENTS)) {
    if (!value || typeof value !== 'object' || !TYPES.has((value as MatchEvent).type)) { skipped++; continue; }
    const e = value as MatchEvent;
    const minute = boundedMinute(e.minute);
    const teamId = storyText(e.teamId, 180);
    const clean: MatchEvent = {
      type: e.type, minute, extraMinute: minute === null ? null : boundedMinute(e.extraMinute, 60), teamId,
      player: storyText(e.player), assist: storyText(e.assist), playerIn: storyText(e.playerIn), playerOut: storyText(e.playerOut),
    };
    const hash = fingerprint(JSON.stringify(clean));
    const occurrence = occurrences.get(hash) ?? 0;
    occurrences.set(hash, occurrence + 1);
    events.push({ ...clean, key: `${hash}-${occurrence}`, segment: eventSegment(minute),
      side: teamId && teamId === match.home.id ? 'home' : teamId && teamId === match.away.id ? 'away' : 'unknown',
    });
  }
  // Base minute first: 45+3 must remain before46, not be interleaved with it.
  events.sort((a, b) => ((a.minute ?? Infinity) - (b.minute ?? Infinity)) || ((a.extraMinute ?? 0) - (b.extraMinute ?? 0)));
  return { events, omitted: Math.max(0, raw.length - MAX_STORY_EVENTS) + skipped, highlights: events.filter(isHighlight) };
}
export function filterStory(events: readonly StoryEvent[], segment: StorySegment): readonly StoryEvent[] {
  return segment === 'all' ? events : events.filter((event) => event.segment === segment);
}
export function adjacentSegment(current: StorySegment, delta: number): StorySegment {
  return STORY_SEGMENTS[Math.max(0, Math.min(STORY_SEGMENTS.length - 1, STORY_SEGMENTS.indexOf(current) + delta))];
}

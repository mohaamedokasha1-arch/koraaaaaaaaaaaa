/**
 * Notifications — event model and subscription model (pure).
 *
 * ARCHITECTURE ONLY: push delivery is deliberately NOT activated. What exists is
 * the part that is expensive to retrofit later — a stable event vocabulary, a
 * subscription shape tied to ENTITIES (team/player/competition/match) instead of
 * free text, quiet hours, and a pure "should this subscriber get this event"
 * decision. Enabling web-push later means adding a transport and a durable store;
 * it does not require redesigning anything here.
 */

export type NotificationEventType =
  | 'match.scheduled'
  | 'match.kickoff'
  | 'match.goal'
  | 'match.card'
  | 'match.halftime'
  | 'match.finished'
  | 'match.postponed'
  | 'news.team'
  | 'news.player'
  | 'transfer.confirmed'
  | 'lineup.published';

export type SubscriptionTopicKind = 'team' | 'player' | 'competition' | 'match' | 'country';

export interface SubscriptionTopic {
  kind: SubscriptionTopicKind;
  /** Entity id from the knowledge model, e.g. `team:al-ahly-eg` or `match:fd~123`. */
  id: string;
}

export type NotificationChannel = 'web-push' | 'in-app' | 'email-digest';

export interface NotificationEvent {
  id: string;
  type: NotificationEventType;
  /** ISO UTC — when the event happened, never when it was rendered. */
  at: string;
  /** Entities this event is about (used to fan-out to subscribers). */
  entityIds: string[];
  matchId: string | null;
  /** Small, locale-neutral payload the transport can render. */
  data: Record<string, string | number | null>;
  /** Short machine key used for de-duplication. */
  dedupeKey: string;
}

export interface Subscription {
  id: string;
  /** Opaque device/channel identifier supplied by the client (not PII). */
  deviceId: string;
  topics: SubscriptionTopic[];
  channels: NotificationChannel[];
  locale: 'ar' | 'en';
  timezone: string;
  /** Optional quiet window in the subscriber's own timezone, "HH:MM". */
  quietHours?: { from: string; to: string } | null;
  createdAt: string;
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  errors: string[];
}

const EVENT_TYPES: NotificationEventType[] = [
  'match.scheduled',
  'match.kickoff',
  'match.goal',
  'match.card',
  'match.halftime',
  'match.finished',
  'match.postponed',
  'news.team',
  'news.player',
  'transfer.confirmed',
  'lineup.published',
];

const TOPIC_KINDS: SubscriptionTopicKind[] = ['team', 'player', 'competition', 'match', 'country'];
const CHANNELS: NotificationChannel[] = ['web-push', 'in-app', 'email-digest'];

export function isNotificationEventType(value: string): value is NotificationEventType {
  return (EVENT_TYPES as string[]).includes(value);
}

export function isSubscriptionTopicKind(value: string): value is SubscriptionTopicKind {
  return (TOPIC_KINDS as string[]).includes(value);
}

/** Timezone strings are validated by the caller; here we only check shape. */
function isQuietTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function validateSubscription(input: unknown): ValidationResult<Subscription> {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') return { ok: false, errors: ['body must be an object'] };
  const raw = input as Record<string, unknown>;

  const deviceId = typeof raw.deviceId === 'string' ? raw.deviceId.trim() : '';
  if (deviceId.length < 8 || deviceId.length > 128) errors.push('deviceId must be 8-128 characters');

  const topicsRaw = Array.isArray(raw.topics) ? raw.topics : [];
  const topics: SubscriptionTopic[] = [];
  for (const topic of topicsRaw.slice(0, 25)) {
    if (!topic || typeof topic !== 'object') continue;
    const candidate = topic as Record<string, unknown>;
    const kind = typeof candidate.kind === 'string' ? candidate.kind : '';
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    if (!isSubscriptionTopicKind(kind)) {
      errors.push(`unknown topic kind: ${String(candidate.kind)}`);
      continue;
    }
    if (!id || id.length > 120) {
      errors.push('topic id must be 1-120 characters');
      continue;
    }
    topics.push({ kind, id });
  }
  if (topics.length === 0) errors.push('at least one topic is required');

  const channelsRaw = Array.isArray(raw.channels) ? raw.channels : [];
  const channels = channelsRaw.filter(
    (channel): channel is NotificationChannel =>
      typeof channel === 'string' && (CHANNELS as string[]).includes(channel),
  );

  const locale = raw.locale === 'ar' || raw.locale === 'en' ? raw.locale : 'ar';
  const timezone = typeof raw.timezone === 'string' && raw.timezone.length <= 64 ? raw.timezone : 'Africa/Cairo';

  let quietHours: Subscription['quietHours'] = null;
  if (raw.quietHours && typeof raw.quietHours === 'object') {
    const quiet = raw.quietHours as Record<string, unknown>;
    if (
      typeof quiet.from === 'string' && typeof quiet.to === 'string' &&
      isQuietTime(quiet.from) && isQuietTime(quiet.to)
    ) {
      quietHours = { from: quiet.from, to: quiet.to };
    } else {
      errors.push('quietHours must be HH:MM pairs');
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    value: {
      id: `sub:${deviceId.slice(0, 16)}`,
      deviceId,
      topics,
      channels: channels.length > 0 ? channels : ['in-app'],
      locale,
      timezone,
      quietHours,
      createdAt: new Date().toISOString(),
    },
  };
}

/** Local minutes-since-midnight for a zone (quiet-hours maths). */
export function minutesOfDayInZone(date: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    return hour * 60 + minute;
  } catch {
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
}

export function inQuietHours(
  at: Date,
  quietHours: Subscription['quietHours'],
  timezone?: string,
): boolean {
  if (!quietHours) return false;
  const from = toMinutes(quietHours.from);
  const to = toMinutes(quietHours.to);
  // Quiet hours are the SUBSCRIBER's local hours, so the window is evaluated in
  // their zone (UTC storage everywhere, local interpretation for people).
  const now = timezone
    ? minutesOfDayInZone(at, timezone)
    : at.getUTCHours() * 60 + at.getUTCMinutes();
  if (from === to) return false;
  // Windows may wrap midnight (e.g. 23:00 → 07:00).
  return from < to ? now >= from && now < to : now >= from || now < to;
}

function toMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Pure fan-out decision. High-priority types (kickoff, goal, finished) bypass
 * quiet hours by design — a fan who muted the app still wants the goal.
 */
export function shouldNotify(
  subscription: Subscription,
  event: NotificationEvent,
  now = new Date(),
): { notify: boolean; reason: string } {
  const subscribed = subscription.topics.some((topic) => event.entityIds.includes(topic.id));
  if (!subscribed) return { notify: false, reason: 'not-subscribed' };

  if (subscription.quietHours) {
    const urgent: NotificationEventType[] = ['match.kickoff', 'match.goal', 'match.finished'];
    if (!urgent.includes(event.type) && inQuietHours(now, subscription.quietHours, subscription.timezone)) {
      return { notify: false, reason: 'quiet-hours' };
    }
  }
  return { notify: true, reason: 'matched' };
}

/**
 * Derive lifecycle events from a match transition. Only REAL transitions produce
 * events: the caller passes what was known before and what is known now, so no
 * event is ever emitted for something the data did not say.
 */
export interface MatchEventInput {
  id: string;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
  leagueId: string | null;
  utcDate: string;
  minute: number | null;
  score: { home: number | null; away: number | null };
  events: { type: string; minute: number | null; player: string | null; teamId: string | null }[];
}

export function deriveMatchEvents(
  previous: MatchEventInput | null,
  current: MatchEventInput,
): NotificationEvent[] {
  const out: NotificationEvent[] = [];
  const entities = [current.homeTeamId, current.awayTeamId, current.id, ...(current.leagueId ? [current.leagueId] : [])];
  const at = new Date().toISOString();

  const push = (type: NotificationEventType, data: Record<string, string | number | null>, dedupeKey: string) => {
    out.push({ id: `${current.id}:${dedupeKey}`, type, at, entityIds: entities, matchId: current.id, data, dedupeKey });
  };

  if (!previous) {
    if (current.status === 'scheduled') push('match.scheduled', { utcDate: current.utcDate }, `scheduled:${current.utcDate}`);
    return out;
  }

  if (previous.status !== current.status) {
    if (current.status === 'live' && previous.status === 'scheduled') {
      push('match.kickoff', { utcDate: current.utcDate }, 'kickoff');
    } else if (current.status === 'halftime') {
      push('match.halftime', { score: scoreText(current) }, 'halftime');
    } else if (current.status === 'finished') {
      push('match.finished', { score: scoreText(current) }, 'finished');
    } else if (current.status === 'postponed') {
      push('match.postponed', { utcDate: current.utcDate }, 'postponed');
    }
  }

  if (previous.score.home != null && current.score.home != null) {
    const before = (previous.score.home ?? 0) + (previous.score.away ?? 0);
    const after = (current.score.home ?? 0) + (current.score.away ?? 0);
    if (after > before) {
      const newGoals = current.events
        .filter((event) => /goal/i.test(event.type))
        .slice(-(after - before));
      for (const goal of newGoals) {
        push(
          'match.goal',
          {
            player: goal.player,
            minute: goal.minute,
            teamId: goal.teamId,
            score: scoreText(current),
          },
          `goal:${goal.minute ?? '?'}:${goal.player ?? '?'}`,
        );
      }
    }
  }

  const previousCards = previous.events.filter((e) => /yellow|red/i.test(e.type)).length;
  const currentCards = current.events.filter((e) => /yellow|red/i.test(e.type));
  if (currentCards.length > previousCards) {
    const card = currentCards[currentCards.length - 1];
    push('match.card', { player: card.player, minute: card.minute, kind: card.type }, `card:${card.minute ?? '?'}:${card.player ?? '?'}`);
  }

  return out;
}

function scoreText(match: MatchEventInput): string | null {
  if (match.score.home == null || match.score.away == null) return null;
  return `${match.score.home}-${match.score.away}`;
}

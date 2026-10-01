import 'server-only';
import type { Subscription } from '@/lib/pure/notifications';
import { log } from '@/lib/log';

/**
 * Notification subscription store — architecture only, no push delivery.
 *
 * What this deliberately does NOT do: send anything. Push activation needs a
 * durable store (Vercel KV/Postgres) plus VAPID keys, which is a product and
 * infrastructure decision, not a code detail. Everything else is ready:
 *
 *   • subscriptions are keyed by ENTITY (team/player/competition/match),
 *   • the event vocabulary lives in `pure/notifications.ts` and is derived from
 *     real match transitions,
 *   • fan-out is a pure decision (`shouldNotify`) with quiet hours,
 *   • the API validates input and says plainly that delivery is not activated.
 *
 * Storage is in-memory per instance, so subscriptions do not survive a cold
 * start. That is stated in the API response (`persistent: false`) instead of
 * pretending otherwise.
 */

interface Store {
  subscriptions: Map<string, Subscription>;
}

const globalForSubs = globalThis as unknown as { __koraSubscriptions?: Store };
const store: Store = globalForSubs.__koraSubscriptions ?? (globalForSubs.__koraSubscriptions = {
  subscriptions: new Map(),
});

const MAX_SUBSCRIPTIONS = 2000;

export function saveSubscription(subscription: Subscription): { saved: boolean; persistent: boolean } {
  if (store.subscriptions.size >= MAX_SUBSCRIPTIONS) {
    // Bounded memory: replace the oldest entry rather than growing without limit.
    const oldest = [...store.subscriptions.entries()].sort((a, b) =>
      a[1].createdAt.localeCompare(b[1].createdAt),
    )[0];
    if (oldest) store.subscriptions.delete(oldest[0]);
  }
  const key = `${subscription.id}:${subscription.deviceId}`;
  store.subscriptions.set(key, subscription);
  log.info('notifications.subscription_saved', {
    topics: subscription.topics.length,
    channels: subscription.channels.join(','),
    locale: subscription.locale,
  });
  return { saved: true, persistent: false };
}

export function removeSubscription(deviceId: string): number {
  let removed = 0;
  for (const [key, subscription] of store.subscriptions) {
    if (subscription.deviceId === deviceId) {
      store.subscriptions.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export function subscriptionCount(): number {
  return store.subscriptions.size;
}

/** Machine-readable description of the architecture for the API and the docs. */
export function notificationsArchitecture() {
  return {
    status: 'architecture-ready' as const,
    pushActivated: false,
    persistent: false,
    eventTypes: [
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
    ],
    topicKinds: ['team', 'player', 'competition', 'match', 'country'],
    channels: ['in-app', 'web-push', 'email-digest'],
    requirementsToActivate: [
      'VAPID keys in environment variables (server only)',
      'a durable subscription store (Vercel KV / Postgres) — the in-memory map is per instance',
      'a delivery worker: cron or an event trigger per derived event',
      'an operator decision on which event types are on by default',
    ],
  };
}

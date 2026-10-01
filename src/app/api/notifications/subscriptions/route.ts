import { NextRequest, NextResponse } from 'next/server';
import { validateSubscription } from '@/lib/pure/notifications';
import {
  notificationsArchitecture,
  removeSubscription,
  saveSubscription,
  subscriptionCount,
} from '@/lib/notifications';
import { rateLimit, tooManyRequests } from '@/lib/ratelimit';
import { getUserTimeZone } from '@/lib/time';

export const dynamic = 'force-dynamic';

/**
 * Notification subscriptions.
 *
 * The event/subscription model is live so the app never needs re-architecting to
 * add push; delivery itself is NOT activated (see GET for the machine-readable
 * state and what activation requires). Nothing is mailed, pushed or shared.
 */

export async function GET() {
  return NextResponse.json({
    ...notificationsArchitecture(),
    subscriptionsOnThisInstance: subscriptionCount(),
    defaultTimezone: await getUserTimeZone(),
  });
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(request, 'notifications', { limit: 20, windowSeconds: 60 });
  if (!limit.ok) return tooManyRequests(limit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const validation = validateSubscription(body);
  if (!validation.ok || !validation.value) {
    return NextResponse.json({ error: 'invalid subscription', details: validation.errors }, { status: 400 });
  }

  const result = saveSubscription(validation.value);
  return NextResponse.json(
    {
      ok: true,
      saved: result.saved,
      persistent: result.persistent,
      pushActivated: false,
      note:
        'Subscription stored for the in-app notification model. Push delivery is not activated; a durable store and VAPID keys are required (see GET).',
    },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function DELETE(request: NextRequest) {
  const limit = rateLimit(request, 'notifications', { limit: 20, windowSeconds: 60 });
  if (!limit.ok) return tooManyRequests(limit);

  const deviceId = request.nextUrl.searchParams.get('deviceId')?.trim() ?? '';
  if (deviceId.length < 8 || deviceId.length > 128) {
    return NextResponse.json({ error: 'deviceId required' }, { status: 400 });
  }
  const removed = removeSubscription(deviceId);
  return NextResponse.json({ ok: true, removed }, { headers: { 'Cache-Control': 'no-store' } });
}

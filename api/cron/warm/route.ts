import { NextRequest, NextResponse } from 'next/server';
import { getLiveMatches, getMatchesByDate, localToday } from '@/lib/football';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Vercel Cron cache warmer — keeps the "live" and "today" caches hot so the
 * first visitor of the day never pays the cold-provider cost.
 *
 * Security: when CRON_SECRET is set in env, callers must send
 *   Authorization: Bearer <CRON_SECRET>
 * (Vercel does this automatically for scheduled crons.) Warming without a
 * secret leaks nothing sensitive, but the check prevents abuse of upstream
 * rate limits.
 *
 * Hobby plan: crons run at most once per day → schedule "0 6 * * *" (default
 * in vercel.json). Pro plan: raise to every 5-15 min for warmer live data.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const today = localToday();
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);

  const results = await Promise.allSettled([
    getLiveMatches(),
    getMatchesByDate(today),
    getMatchesByDate(yesterday),
    getMatchesByDate(tomorrow),
  ]);

  const ok = results.filter((r) => r.status === 'fulfilled').length;
  return NextResponse.json({
    warmed: ok,
    failed: results.length - ok,
    at: new Date().toISOString(),
  });
}

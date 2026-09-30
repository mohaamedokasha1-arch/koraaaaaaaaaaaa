import { NextRequest, NextResponse } from 'next/server';
import { getLiveMatches, getMatchesByDate, localToday } from '@/lib/football';
import type { DataResult, UnifiedMatch } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Vercel Cron cache warmer. It refreshes the current live scoreboard and the
 * surrounding day buckets, using the same provider fallback chain as page
 * requests. This is a best-effort warmer, not a durable background sync: the
 * cache is in-memory per serverless instance.
 *
 * Security: when CRON_SECRET is set in env, callers must send
 *   Authorization: Bearer <CRON_SECRET>
 * (Vercel Cron does this automatically.) Configure it in production to stop
 * public callers from spending the upstream providers' rate limits.
 */

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function matchCount(data: unknown): number | null {
  return Array.isArray(data) ? data.length : null;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const today = localToday();
  const jobs: { name: string; run: () => Promise<DataResult<UnifiedMatch[]>> }[] = [
    { name: 'live', run: getLiveMatches },
    { name: 'today', run: () => getMatchesByDate(today) },
    { name: 'yesterday', run: () => getMatchesByDate(shiftDate(today, -1)) },
    { name: 'tomorrow', run: () => getMatchesByDate(shiftDate(today, 1)) },
  ];

  const tasks = await Promise.all(jobs.map(async ({ name, run }) => {
    try {
      const result = await run();
      return {
        name,
        ok: true,
        stale: result.stale,
        source: result.source,
        fetchedAt: result.fetchedAt,
        matches: matchCount(result.data),
      };
    } catch {
      // Do not expose provider URLs or provider-specific errors in a public response.
      return { name, ok: false, stale: false, source: 'none', fetchedAt: null, matches: null };
    }
  }));

  const failed = tasks.filter((task) => !task.ok).length;
  const stale = tasks.filter((task) => task.ok && task.stale).length;
  const warmed = tasks.filter((task) => task.ok && !task.stale).length;

  return NextResponse.json(
    {
      ok: failed === 0 && stale === 0,
      warmed,
      stale,
      failed,
      tasks,
      at: new Date().toISOString(),
    },
    { status: failed === tasks.length ? 503 : 200, headers: { 'Cache-Control': 'no-store' } },
  );
}

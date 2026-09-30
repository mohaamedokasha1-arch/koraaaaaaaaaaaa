import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, tooManyRequests } from '@/lib/ratelimit';
import { getLiveMatches, ServiceError } from '@/lib/football';

export const dynamic = 'force-dynamic';

/** Client polling endpoint — all users share the server's provider cache,
 * so this never scales upstream calls with traffic. */
export async function GET(request: NextRequest) {
  // Generous ceiling: the page polls every 30s, so a real user stays far below it.
  const limit = rateLimit(request, 'live', { limit: 120, windowSeconds: 60 });
  if (!limit.ok) return tooManyRequests(limit);

  try {
    const result = await getLiveMatches();
    return NextResponse.json(
      { matches: result.data, stale: result.stale, source: result.source, fetchedAt: result.fetchedAt },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ matches: [], stale: false, source: 'none', fetchedAt: new Date().toISOString() });
    }
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
}

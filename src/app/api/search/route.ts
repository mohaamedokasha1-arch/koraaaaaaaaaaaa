import { NextRequest, NextResponse } from 'next/server';
import { search } from '@/lib/football';
import { rateLimit, tooManyRequests } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Abuse protection: a runaway client must not be able to spend provider quota.
  const limit = rateLimit(request, 'search', { limit: 40, windowSeconds: 60 });
  if (!limit.ok) return tooManyRequests(limit);

  const q = request.nextUrl.searchParams.get('q') ?? '';
  if (q.trim().length > 60) {
    return NextResponse.json({ error: 'query too long' }, { status: 400 });
  }
  try {
    const result = await search(q);
    return NextResponse.json(
      { hits: result.data, stale: result.stale, fetchedAt: result.fetchedAt },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
  } catch {
    return NextResponse.json({ hits: [], stale: false, fetchedAt: new Date().toISOString() });
  }
}

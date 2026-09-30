import { NextResponse } from 'next/server';
import { getLiveMatches, ServiceError } from '@/lib/football';

export const dynamic = 'force-dynamic';

/** Client polling endpoint — all users share the server's provider cache,
 * so this never scales upstream calls with traffic. */
export async function GET() {
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

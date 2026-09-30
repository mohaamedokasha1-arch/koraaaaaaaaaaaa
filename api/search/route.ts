import { NextRequest, NextResponse } from 'next/server';
import { search } from '@/lib/football';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

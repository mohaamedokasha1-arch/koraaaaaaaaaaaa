import { NextRequest, NextResponse } from 'next/server';
import { search } from '@/lib/football';
import { searchUnified } from '@/lib/search';
import { rateLimit, tooManyRequests } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

/**
 * Public search endpoint.
 *
 * Response is backward compatible: `hits` still carries the same
 * team/league objects clients already consume. The unified entity-aware result
 * is added alongside it (`groups`, `disambiguation`, `players`, `matches`,
 * `news`, `counts`) so the UI can show grouped results without a new endpoint.
 */
export async function GET(request: NextRequest) {
  // Abuse protection: a runaway client must not be able to spend provider quota.
  const limit = rateLimit(request, 'search', { limit: 40, windowSeconds: 60 });
  if (!limit.ok) return tooManyRequests(limit);

  const q = request.nextUrl.searchParams.get('q') ?? '';
  if (q.trim().length > 60) {
    return NextResponse.json({ error: 'query too long' }, { status: 400 });
  }

  try {
    const [legacy, unified] = await Promise.all([search(q), searchUnified(q)]);
    return NextResponse.json(
      {
        // Legacy contract (unchanged shape).
        hits: legacy.data,
        stale: legacy.stale,
        fetchedAt: legacy.fetchedAt,
        // Additive: grouped, entity-aware results.
        query: unified.data.query,
        normalized: unified.data.normalized,
        groups: {
          entities: unified.data.entities,
          teams: unified.data.teams,
          leagues: unified.data.leagues,
          players: unified.data.players,
          matches: unified.data.matches,
          news: unified.data.news.slice(0, 10),
          stories: unified.data.stories.slice(0, 5),
        },
        disambiguation: unified.data.disambiguation,
        counts: {
          entities: unified.data.entities.length,
          teams: unified.data.teams.length,
          leagues: unified.data.leagues.length,
          players: unified.data.players.length,
          matches: unified.data.matches.length,
          news: unified.data.news.length,
        },
        expansions: unified.data.expansions,
        source: unified.source,
      },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
  } catch {
    return NextResponse.json({
      hits: [],
      stale: false,
      fetchedAt: new Date().toISOString(),
      groups: { entities: [], teams: [], leagues: [], players: [], matches: [], news: [], stories: [] },
      disambiguation: null,
      counts: { entities: 0, teams: 0, leagues: 0, players: 0, matches: 0, news: 0 },
    });
  }
}

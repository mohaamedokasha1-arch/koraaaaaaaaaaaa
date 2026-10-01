import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, tooManyRequests } from '@/lib/ratelimit';
import { getNewsBundle, newsEnabled, newsSectionCounts } from '@/lib/news';
import type { NewsHubSection } from '@/lib/types';

export const dynamic = 'force-dynamic';

const SECTIONS: NewsHubSection[] = ['latest', 'egypt', 'arab', 'england', 'spain', 'italy', 'germany', 'france', 'africa', 'europe', 'world'];

/**
 * Paginated news feed (opt-in feature).
 *
 * Additive endpoint: `{ entries, stories, partial, fetchedAt, counts }`.
 * When no source is enabled the feature is inert and this answers with an empty
 * list (never an error, never a fabricated item). Rate limited like the other
 * public read endpoints; the heavy lifting is shared through the server cache.
 */
export async function GET(request: NextRequest) {
  const limit = rateLimit(request, 'news', { limit: 60, windowSeconds: 60 });
  if (!limit.ok) return tooManyRequests(limit);

  if (!newsEnabled()) {
    return NextResponse.json(
      { entries: [], stories: [], partial: false, filtered: 0, counts: {}, fetchedAt: null, enabled: false },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const { searchParams } = new URL(request.url);
  const sectionParam = searchParams.get('section');
  const section = (SECTIONS as string[]).includes(sectionParam ?? '') ? (sectionParam as NewsHubSection) : 'latest';
  const page = Math.max(1, Math.min(50, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1));
  const limitParam = Math.max(1, Math.min(48, Number.parseInt(searchParams.get('limit') ?? '24', 10) || 24));
  const langParam = searchParams.get('lang');
  const language = langParam === 'ar' || langParam === 'en' ? langParam : undefined;
  const entityId = searchParams.get('entity') ?? undefined;

  try {
    const result = await getNewsBundle({
      section,
      language,
      entityId,
      limit: limitParam,
      offset: (page - 1) * limitParam,
    });
    const counts = await newsSectionCounts().catch(() => ({} as Record<string, number>));

    return NextResponse.json(
      {
        entries: result.data.entries,
        stories: result.data.stories,
        partial: result.data.partial,
        filtered: result.data.filtered,
        counts,
        page,
        enabled: true,
        stale: result.stale,
        source: result.source,
        fetchedAt: result.fetchedAt,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    // Total outage: the site must keep working and say nothing it cannot prove.
    return NextResponse.json(
      { entries: [], stories: [], partial: true, filtered: 0, counts: {}, page, enabled: true, stale: false, source: 'none', fetchedAt: null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

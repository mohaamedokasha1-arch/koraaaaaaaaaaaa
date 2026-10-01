import { getMatchMemo } from '@/lib/football';
import { rateLimit } from '@/lib/ratelimit';
import { log } from '@/lib/log';
import { serveShareImage } from '@/features/share-cards/lib/image-http';
import { renderShareImage } from '@/features/share-cards/lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ locale: string; id: string }> }) {
  return serveShareImage(request, await params, {
    getMatch: getMatchMemo, render: renderShareImage,
    limit: (req) => rateLimit(req, 'match-share-image', { limit: 60, windowSeconds: 60, allowCrawlerBypass: false }),
    onUnavailable: () => log.warn('match.share_image_unavailable'),
  });
}

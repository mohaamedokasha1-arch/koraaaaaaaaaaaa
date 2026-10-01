import type { Locale } from '../../../i18n/locales';
import type { DataResult, UnifiedMatch } from '../../../lib/types';
import { buildShareCard, validCardMatchId, type ShareCardModel } from './model.ts';

export interface ShareImageDependencies {
  getMatch: (id: string) => Promise<DataResult<UnifiedMatch> | null>;
  render: (model: ShareCardModel) => Promise<Uint8Array>;
  limit: (request: Request) => { ok: boolean; retryAfterSeconds: number };
  onUnavailable?: () => void;
}
const safeHeaders = { 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; base-uri 'none'; sandbox" };
function error(status: number, code: string, retry?: number) {
  return new Response(JSON.stringify({ error: code }), { status, headers: { ...safeHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(retry ? { 'Retry-After': `${retry}` } : {}) } });
}

/** Public immutable-response snapshot. No cookies, free-text queries or crest proxy. */
export async function serveShareImage(request: Request, params: { locale: string; id: string }, deps: ShareImageDependencies): Promise<Response> {
  if (!['ar', 'en'].includes(params.locale) || !validCardMatchId(params.id)) return error(404, 'invalid_match');
  if (new URL(request.url).search) return error(400, 'unsupported_query');
  const limit = deps.limit(request);
  if (!limit.ok) return error(429, 'too_many_requests', Math.max(1, limit.retryAfterSeconds));
  try {
    const result = await deps.getMatch(params.id);
    if (!result) return error(404, 'match_not_found');
    const model = buildShareCard(result, params.locale as Locale);
    if (!model) return error(404, 'snapshot_unavailable');
    const png = await deps.render(model);
    if (png.byteLength === 0 || png.byteLength > 512_000) throw new Error('image_size');
    return new Response(png, { headers: {
      ...safeHeaders, 'Content-Type': 'image/png',
      'Cache-Control': model.stale ? 'no-store' : model.variant === 'result' ? 'public, max-age=60, s-maxage=300' : 'public, max-age=0, s-maxage=30',
      ...(model.fetchedAt ? { 'X-Kora-Snapshot-At': model.fetchedAt } : {}),
    } });
  } catch {
    // No provider URL, error text, key, IP, cookies or personal data in the log.
    try { deps.onUnavailable?.(); } catch { /* diagnostics must not break delivery */ }
    return error(503, 'image_unavailable', 30);
  }
}

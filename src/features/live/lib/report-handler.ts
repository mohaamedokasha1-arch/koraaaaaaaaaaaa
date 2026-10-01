import { enum as zEnum, number as zNumber, object as zObject } from 'zod';
import type { z } from 'zod';
import { reportSchema } from '../types/index.ts';
import { anonymousHash, BodyError, readSmallJson, requestIdentity, sameOriginRequest } from './http.ts';

export interface ReportEnvironment { enabled: boolean; url?: string; serviceRole?: string; salt?: string; siteUrl?: string }
const reportResult = zObject({ outcome: zEnum(['accepted', 'duplicate', 'rate_limited', 'unknown_stream']), retry_after: zNumber().int().min(0).max(3600).default(0) });
function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

/** Edge-safe, durable-only writes. No in-memory counts pretending to persist. */
export async function handleLiveReport(request: Request, env: ReportEnvironment, fetcher: typeof fetch = fetch): Promise<Response> {
  if (!env.enabled) return json({ error: 'disabled' }, 404);
  if (!sameOriginRequest(request, env.siteUrl)) return json({ error: 'origin' }, 403);
  if (!env.url || !env.serviceRole || !env.salt || env.salt.length < 32) return json({ error: 'reporting_not_configured' }, 503);
  let payload: z.infer<typeof reportSchema>;
  try { payload = reportSchema.parse(await readSmallJson(request)); }
  catch (error) { return json({ error: 'invalid_request' }, error instanceof BodyError ? error.status : 400); }
  try {
    const reporter = await anonymousHash(`live-report:${requestIdentity(request.headers)}`, env.salt);
    const response = await fetcher(`${env.url}/rest/v1/rpc/record_live_report`, {
      method: 'POST', headers: { apikey: env.serviceRole, Authorization: `Bearer ${env.serviceRole}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_match_id: payload.matchId, p_stream_id: payload.streamId, p_reporter_hash: reporter }),
      cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return json({ error: 'reporting_unavailable' }, 503);
    const result = reportResult.parse(await response.json());
    if (result.outcome === 'unknown_stream') return json({ error: 'unknown_stream' }, 404);
    if (result.outcome === 'rate_limited') return json({ error: 'rate_limited' }, 429, { 'Retry-After': String(Math.max(1, result.retry_after)) });
    return json({ accepted: true, duplicate: result.outcome === 'duplicate' });
  } catch { return json({ error: 'reporting_unavailable' }, 503); }
}

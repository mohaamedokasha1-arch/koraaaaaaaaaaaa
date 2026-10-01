import { NextRequest, NextResponse } from 'next/server';
import { parseDashboardSelection } from '@/features/personalization/lib/dashboard';
import { getPersonalDashboard } from '@/features/personalization/lib/server';
import { readBoundedJson, sameOriginRequest } from '@/features/personalization/lib/http';
import { getUserTimeZone } from '@/lib/time';
import { rateLimit, tooManyRequests } from '@/lib/ratelimit';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };

/** No account, persistence or preference mutation. Body IDs never enter URLs/logs. */
export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403, headers });
  const limit = rateLimit(request, 'personalization-dashboard', { limit: 20, windowSeconds: 60, allowCrawlerBypass: false });
  if (!limit.ok) {
    const response = tooManyRequests(limit);
    for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
    return response;
  }
  let body: unknown;
  try { body = await readBoundedJson(request); }
  catch (error) {
    const kind = error instanceof Error ? error.message : 'invalid_json';
    const status = kind === 'payload_too_large' ? 413 : kind === 'unsupported_content_type' ? 415 : 400;
    return NextResponse.json({ error: kind }, { status, headers });
  }
  const selection = parseDashboardSelection(body);
  if (!selection || selection.teams.length + selection.leagues.length === 0) {
    return NextResponse.json({ error: 'invalid_selection' }, { status: 400, headers });
  }
  try {
    const dashboard = await getPersonalDashboard(selection, await getUserTimeZone());
    return NextResponse.json(dashboard, { status: dashboard.coverage === 'unavailable' ? 503 : 200, headers });
  } catch {
    // Only the event/code: no favourite IDs, request bodies, IPs or cookies.
    log.warn('personalization.dashboard_unavailable');
    return NextResponse.json({ error: 'data_unavailable' }, { status: 503, headers });
  }
}

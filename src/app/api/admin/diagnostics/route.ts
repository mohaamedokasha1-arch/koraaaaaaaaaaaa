import { NextRequest, NextResponse } from 'next/server';
import { diagnosticsReport } from '@/lib/observability';
import { orphanReport } from '@/lib/seo/orphans';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Internal diagnostics (never public).
 *
 * Protected by DIAGNOSTICS_TOKEN, falling back to CRON_SECRET so a project that
 * already has the cron secret does not need a second variable. Without either
 * variable configured the endpoint answers 404 — it does not exist for the
 * public, and it never leaks a secret or a provider URL.
 */
function authorized(request: NextRequest): boolean {
  const token = process.env.DIAGNOSTICS_TOKEN ?? process.env.CRON_SECRET;
  if (!token) return false;
  const header = request.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const query = request.nextUrl.searchParams.get('token') ?? '';
  return bearer === token || query === token;
}

export async function GET(request: NextRequest) {
  if (!(process.env.DIAGNOSTICS_TOKEN || process.env.CRON_SECRET)) {
    return new NextResponse(null, { status: 404 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const report = diagnosticsReport();
  if (report.overall !== 'ok') {
    log[report.overall === 'critical' ? 'error' : 'warn']('diagnostics.report', {
      overall: report.overall,
      failed: report.checks.filter((c) => c.level !== 'ok').map((c) => c.id),
    });
  }

  // Orphan-page report rides along with diagnostics: same protection, no extra
  // endpoint for an operator to remember.
  const orphans = await orphanReport().catch(() => null);

  return NextResponse.json(
    orphans ? { ...report, orphans } : report,
    {
      status: report.overall === 'critical' ? 503 : 200,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

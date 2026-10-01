import { LIVE_ENABLED, publicLiveStore } from '@/features/live/lib/config';
import { handleLiveReport } from '@/features/live/lib/report-handler';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/** The broadcast feature's only Route Handler. Video never crosses this route. */
export async function POST(request: Request) {
  return handleLiveReport(request, {
    enabled: LIVE_ENABLED,
    url: publicLiveStore()?.url,
    serviceRole: process.env.LIVE_SUPABASE_SERVICE_ROLE_KEY,
    salt: process.env.LIVE_REPORT_SALT,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  });
}

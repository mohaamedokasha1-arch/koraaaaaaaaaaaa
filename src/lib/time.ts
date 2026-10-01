import 'server-only';
import { cookies } from 'next/headers';
import { resolveTimeZone, TIMEZONE_COOKIE } from '@/lib/pure/time';

/**
 * Server-side timezone access.
 *
 * The pure helpers live in `pure/time.ts` so client components (the picker) can
 * import the same constants without pulling `next/headers` into the browser
 * bundle. This file adds only the request-scoped read.
 */

export {
  DEFAULT_TZ,
  TIMEZONE_CHOICES,
  TIMEZONE_COOKIE,
  isValidTimeZone,
  resolveTimeZone,
  localDayInZone,
  zoneLabel,
} from '@/lib/pure/time';

/** The viewer's zone for this request (server components / route handlers). */
export async function getUserTimeZone(): Promise<string> {
  try {
    const store = await cookies();
    return resolveTimeZone(store.get(TIMEZONE_COOKIE)?.value ?? null);
  } catch {
    // Outside a request scope (build, cron) the project default applies.
    return resolveTimeZone(null);
  }
}

import 'server-only';
import { getLiveMatches, getMatchesByDate } from '@/lib/football';
import { entityByRef } from '@/lib/entities';
import { getNewsBundle, newsEnabled } from '@/lib/news';
import { isValidTimeZone, localDayInZone } from '@/lib/pure/time';
import { buildDashboard, utcDatesForLocalDay, type DashboardSelection } from './dashboard';

// Share bulk provider reads across preference combinations in a warm instance.
// No user selections or personalised payloads enter this map or the shared cache.
const inflight = new Map<string, Promise<unknown>>();
function shared<T>(key: string, load: () => Promise<T>): Promise<T> {
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const request = load().finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}
function entityIdForTeam(providerId: string): string | null {
  const provider = providerId.split('~')[0];
  return entityByRef(provider, providerId)?.id ?? null;
}

export async function getPersonalDashboard(selection: DashboardSelection, selectedTimeZone: string) {
  const now = Date.now();
  const timeZone = isValidTimeZone(selectedTimeZone) ? selectedTimeZone : 'Africa/Cairo';
  const day = localDayInZone(new Date(now).toISOString(), timeZone);
  const dates = utcDatesForLocalDay(day, timeZone);
  const enabledNews = newsEnabled();
  // Constant-cost bulk operations, never one request per followed team/player.
  const [daily, live, news] = await Promise.all([
    Promise.all(dates.map((date) => shared(`day:${date}`, () => getMatchesByDate(date)).catch(() => null))),
    shared('live', getLiveMatches).catch(() => null),
    enabledNews ? shared('news', () => getNewsBundle({ limit: 200 }))
      .then((result) => ({ ...result, data: result.data.entries })).catch(() => null) : Promise.resolve(null),
  ]);
  return buildDashboard({ day, timeZone, now, selection, daily, live, news, newsEnabled: enabledNews, entityIdForTeam });
}

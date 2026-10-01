import 'server-only';
import { cookies, headers } from 'next/headers';
import { boolean as zBoolean, number as zNumber, object as zObject } from 'zod';
import { LIVE_ENABLED } from './config.ts';
import { writableLiveStore, liveRpc } from './store-server.ts';
import { anonymousHash, requestIdentity } from './http.ts';
import { verifyAdminSession } from './auth-crypto.ts';

export const ADMIN_COOKIE = 'kora_live_admin';
export function adminConfigured(): boolean {
  return LIVE_ENABLED && Boolean(writableLiveStore()) && (process.env.LIVE_ADMIN_PASSWORD?.length ?? 0) >= 24 && (process.env.LIVE_REPORT_SALT?.length ?? 0) >= 32;
}
export async function isLiveAdmin(): Promise<boolean> {
  if (!adminConfigured()) return false;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return Boolean(token && await verifyAdminSession(token, process.env.LIVE_ADMIN_PASSWORD!, Date.now()));
}
export async function allowAdminAttempt(scope: 'login' | 'save'): Promise<boolean> {
  const key = await anonymousHash(`live-admin:${scope}:${requestIdentity(new Headers(await headers()))}`, process.env.LIVE_REPORT_SALT!);
  const result = await liveRpc('consume_live_limit', { p_key: `admin:${scope}:${key}`, p_limit: scope === 'login' ? 5 : 10, p_window_seconds: scope === 'login' ? 900 : 60 }, zObject({ allowed: zBoolean(), retry_after: zNumber() }));
  return result.allowed;
}

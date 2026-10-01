import 'server-only';
import { z } from 'zod';
import { publicLiveStore } from './config.ts';

export function writableLiveStore() {
  const publicStore = publicLiveStore();
  const serviceRole = process.env.LIVE_SUPABASE_SERVICE_ROLE_KEY;
  if (!publicStore || !serviceRole) return null;
  return { url: publicStore.url, serviceRole };
}

/** Raw REST keeps the optional storage integration dependency-free. */
export async function liveRpc<T>(name: string, args: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const store = writableLiveStore();
  if (!store || !/^[a-z_]+$/.test(name)) throw new Error('Live store is not configured');
  const response = await fetch(`${store.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: store.serviceRole, Authorization: `Bearer ${store.serviceRole}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args), cache: 'no-store', signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Live store operation failed');
  return schema.parse(await response.json());
}

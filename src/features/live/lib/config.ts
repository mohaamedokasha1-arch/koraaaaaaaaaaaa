/** One opt-in switch for pages, navigation, player, polling and report writes. */
export const LIVE_ENABLED = process.env.NEXT_PUBLIC_LIVE_ENABLED === 'true';
export const LIVE_POLL_MS = 45_000;
export const IFRAME_TIMEOUT_MS = 12_000;
export const MAX_STREAM_ATTEMPTS = 2;

/** Public read-only credentials only. Never put a service-role key here. */
export function publicLiveStore() {
  const url = process.env.NEXT_PUBLIC_LIVE_SUPABASE_URL?.replace(/\/+$/, '');
  const anonKey = process.env.NEXT_PUBLIC_LIVE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || (parsed.port && parsed.port !== '443')) return null;
    return { url: parsed.origin, anonKey };
  } catch { return null; }
}

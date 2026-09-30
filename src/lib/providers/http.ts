/**
 * Shared HTTP helper for provider adapters: timeout, retry with backoff,
 * and typed errors so the fallback layer can distinguish failure modes.
 */

export const PROVIDER_UA = 'KoraScore/0.1 (+https://korascore.app)';

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | 'unsupported' // provider doesn't offer this capability
      | 'auth' // bad/missing credentials
      | 'plan' // plan/limitation blocks this endpoint (e.g. 403)
      | 'rate_limit' // 429
      | 'http' // other HTTP errors
      | 'network', // fetch threw / timeout
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

const DEFAULT_TIMEOUT = Number(process.env.PROVIDER_TIMEOUT_MS ?? 8000);
const MAX_RETRIES = Number(process.env.PROVIDER_MAX_RETRIES ?? 1);
/** Static open datasets (openfootball) and RSS feeds can be larger/slower. */
const DEFAULT_TEXT_TIMEOUT = Number(process.env.PROVIDER_TEXT_TIMEOUT_MS ?? 12_000);
/** Hard ceiling on any single external text response, protects serverless memory. */
const MAX_TEXT_BYTES = Number(process.env.PROVIDER_MAX_TEXT_BYTES ?? 4_000_000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Plain-text/XML download with the same timeout, retry and error taxonomy as fetchJson. */
export async function fetchText(
  url: string,
  init: { headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<string> {
  const timeoutMs = init.timeoutMs ?? DEFAULT_TEXT_TIMEOUT;
  let attempt = 0;

  for (;;) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': PROVIDER_UA,
          ...init.headers,
        },
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);

      if (res.ok) {
        const text = await res.text();
        if (text.length > MAX_TEXT_BYTES) throw new ProviderError(`${url} exceeded size budget`, 'http');
        return text;
      }

      if (res.status === 429) throw new ProviderError(`${url} rate limited`, 'rate_limit', 429);
      if (res.status === 401) throw new ProviderError(`${url} unauthorized`, 'auth', 401);
      if (res.status === 403) throw new ProviderError(`${url} forbidden`, 'plan', 403);
      if (res.status === 404) throw new ProviderError(`${url} not found`, 'unsupported', 404);
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        attempt += 1;
        await sleep(400 * attempt);
        continue;
      }
      throw new ProviderError(`${url} responded ${res.status}`, 'http', res.status);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ProviderError) throw err;
      if (attempt < MAX_RETRIES) {
        attempt += 1;
        await sleep(400 * attempt);
        continue;
      }
      const msg = err instanceof Error && err.name === 'AbortError'
        ? `${url} timed out after ${timeoutMs}ms`
        : `${url} network error: ${err instanceof Error ? err.message : String(err)}`;
      throw new ProviderError(msg, 'network');
    }
  }
}

export async function fetchJson<T>(
  url: string,
  init: { headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<T> {
  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT;
  let attempt = 0;

  // retry only network errors and 5xx; everything else fails fast
  // so the fallback chain can engage quickly.
  for (;;) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': PROVIDER_UA,
          ...init.headers,
        },
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);

      if (res.ok) return (await res.json()) as T;

      if (res.status === 429) throw new ProviderError(`${url} rate limited`, 'rate_limit', 429);
      if (res.status === 401) throw new ProviderError(`${url} unauthorized`, 'auth', 401);
      if (res.status === 403) throw new ProviderError(`${url} forbidden (plan limitation)`, 'plan', 403);
      if (res.status === 404) throw new ProviderError(`${url} not found`, 'http', 404);
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        attempt += 1;
        await sleep(400 * attempt);
        continue;
      }
      throw new ProviderError(`${url} responded ${res.status}`, 'http', res.status);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ProviderError) throw err;
      if (attempt < MAX_RETRIES) {
        attempt += 1;
        await sleep(400 * attempt);
        continue;
      }
      const msg = err instanceof Error && err.name === 'AbortError'
        ? `${url} timed out after ${timeoutMs}ms`
        : `${url} network error: ${err instanceof Error ? err.message : String(err)}`;
      throw new ProviderError(msg, 'network');
    }
  }
}

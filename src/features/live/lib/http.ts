export class BodyError extends Error {
  status: number;
  constructor(status: number) { super('Invalid request body'); this.status = status; }
}

/** Enforce a byte limit even for chunked bodies, before parsing untrusted JSON. */
export async function readSmallJson(request: Request, maxBytes = 1024): Promise<unknown> {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) throw new BodyError(415);
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new BodyError(413);
  if (!request.body) throw new BodyError(400);
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new BodyError(413); }
      chunks.push(value);
    }
    const buffer = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)) as unknown;
  } catch (error) {
    if (error instanceof BodyError) throw error;
    throw new BodyError(400);
  } finally { reader.releaseLock(); }
}

/** Browser-origin guard; never permits '*' or arbitrary preview host suffixes. */
export function sameOriginRequest(request: Request, siteUrl?: string): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol)) return false;
    const own = new URL(request.url);
    const allowed = new Set([own.origin]);
    // Next's request URL can be internal behind a trusted reverse proxy; Host
    // retains the public preview hostname. Browsers cannot set this header.
    const host = request.headers.get('host');
    if (host && /^[a-zA-Z0-9.-]+(?::\d+)?$/.test(host)) {
      allowed.add(`${own.protocol}//${host}`);
      allowed.add(`https://${host}`);
    }
    if (siteUrl) allowed.add(new URL(siteUrl).origin);
    return allowed.has(origin);
  } catch { return false; }
}

export function requestIdentity(headers: Headers, trustProxy = process.env.LIVE_TRUST_PROXY_HEADERS === 'true', vercel = process.env.VERCEL === '1'): string {
  // Never let a direct client invent distinct reporters via spoofed IP headers.
  // Unknown/untrusted deployments share a conservative bucket until configured.
  if (!vercel && !trustProxy) return 'unknown';
  const address = vercel ? headers.get('x-vercel-forwarded-for') ?? headers.get('x-forwarded-for') : headers.get('x-real-ip') ?? headers.get('x-forwarded-for');
  return (address ?? 'unknown').split(',')[0].trim().slice(0, 128) || 'unknown';
}

export async function anonymousHash(identity: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(identity)));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

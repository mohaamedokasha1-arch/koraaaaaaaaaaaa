/** Read a JSON body with an actual byte ceiling, including chunked requests. */
export async function readBoundedJson(request: Request, maxBytes = 16_384): Promise<unknown> {
  if ((request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') throw new Error('unsupported_content_type');
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new Error('payload_too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid_json');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error('payload_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(merged)); }
  catch { throw new Error('invalid_json'); }
}

/** Guest read-only endpoint; reject cross-site browser calls before doing IO. */
export function sameOriginRequest(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true; // server/CLI read-only client, not cookie authentication
  try {
    const source = new URL(origin);
    if (!['https:', 'http:'].includes(source.protocol) || source.username || source.password ||
        source.pathname !== '/' || source.search || source.hash) return false;
    const internal = new URL(request.url);
    // Next's Node adapter can normalise request.url to localhost. The incoming
    // Host remains the browser-facing authority; the HTTPS proxy supplies proto.
    // Do not accept an arbitrary x-forwarded-host in place of that authority.
    const host = request.headers.get('host')?.trim().toLowerCase() ?? internal.host;
    if (!/^[a-z0-9.\-\[\]:]+$/i.test(host)) return false;
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim().toLowerCase();
    if (forwardedProto && forwardedProto !== 'https' && forwardedProto !== 'http') return false;
    const protocol = forwardedProto ? `${forwardedProto}:` : internal.protocol;
    return source.origin === new URL(`${protocol}//${host}`).origin;
  } catch { return false; }
}

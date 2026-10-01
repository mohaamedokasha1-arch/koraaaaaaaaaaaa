import { anonymousHash } from './http.ts';

function equalHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

export async function comparePassword(candidate: string, expected: string): Promise<boolean> {
  const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return equalHex(await digest(candidate), await digest(expected));
}

export async function signAdminSession(secret: string, now: number): Promise<string> {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const payload = btoa(JSON.stringify({ expiresAt: now + 8 * 60 * 60 * 1000, nonce })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${payload}.${await anonymousHash(`live-admin:${payload}`, secret)}`;
}

export async function verifyAdminSession(token: string, secret: string, now: number): Promise<boolean> {
  if (token.length > 1024) return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra || !/^[a-zA-Z0-9_-]+$/.test(payload) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = await anonymousHash(`live-admin:${payload}`, secret);
  if (!equalHex(signature, expected)) return false;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { expiresAt?: unknown; nonce?: unknown };
    return typeof claims.expiresAt === 'number' && claims.expiresAt > now && claims.expiresAt <= now + 8 * 60 * 60 * 1000 && typeof claims.nonce === 'string' && /^[a-f0-9]{32}$/.test(claims.nonce);
  } catch { return false; }
}

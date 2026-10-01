/**
 * Structured logging (server only).
 *
 * Rules that matter for a site that handles provider keys:
 *   • never log a value whose key looks like a secret,
 *   • never log a full provider URL with a key in the query string,
 *   • one line per event, JSON, so Vercel's log viewer can filter it.
 *
 * Logging is best-effort: it must never throw into a request path.
 */

const SECRET_KEY = /(secret|token|apikey|api_key|key|authorization|cookie|password)/i;
const MAX_DEPTH = 4;
const MAX_STRING = 300;

export type LogLevel = 'info' | 'warn' | 'error';

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[depth]';
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactValue(item, depth + 1));
  if (value instanceof Error) {
    return { name: value.name, message: value.message.slice(0, MAX_STRING) };
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(key)) {
        out[key] = '[redacted]';
        continue;
      }
      out[key] = redactValue(item, depth + 1);
    }
    return out;
  }
  return '[unloggable]';
}

/** Strip credentials/keys from any URL before it can reach a log line. */
export function safeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      if (SECRET_KEY.test(key)) url.searchParams.set(key, '[redacted]');
    }
    return url.toString();
  } catch {
    return raw.split('?')[0];
  }
}

export function logEvent(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  try {
    const line = JSON.stringify({
      at: new Date().toISOString(),
      level,
      event,
      ...(redactValue(fields) as Record<string, unknown>),
    });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  } catch {
    // Logging must never break a request.
  }
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => logEvent('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => logEvent('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => logEvent('error', event, fields),
};

export { redactValue };

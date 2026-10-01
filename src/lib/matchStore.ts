import 'server-only';
import type { UnifiedMatch } from '@/lib/types';
import { cache } from '@/lib/cache';
import type { Conflict, Issue, MatchStatus, SourceMeta } from '@/lib/pure/validation';
import {
  hasErrors,
  isLiveStatus,
  mergeEvents,
  reconcileMatch,
  validateMatch,
} from '@/lib/pure/validation';

/**
 * Validated, provenance-aware match store.
 *
 * Why it exists: with four providers answering for the same fixture, the naive
 * "last response wins" rule lets a slow provider overwrite a fresh score. Here
 * every match that the app is about to display passes through a single gate:
 *
 *   validate → state machine → freshness/priority → merge events → record
 *
 * The gate keeps the safest value, records every conflict for the internal log
 * and remembers where each match came from and when it was last touched. It is
 * in-memory per serverless instance (same trade-off as the rest of the cache
 * layer, documented in docs/OPERATIONS.md) and it never invents data: a match
 * with no valid stored record simply keeps whatever the provider just returned.
 */

/** Field-level source priority. Higher wins ties; used for freshness ordering. */
export const SOURCE_PRIORITY: Record<string, number> = {
  fd: 100,
  af: 90,
  espn: 60,
  tsdb: 40,
  ofb: 30,
  static: 10,
};

export function priorityOf(source: string): number {
  return SOURCE_PRIORITY[source] ?? 50;
}

export interface MatchProvenance {
  matchId: string;
  source: string;
  priority: number;
  updatedAt: string;
  firstSeenAt: string;
  stale: boolean;
  conflicts: number;
}

interface StoredMatch {
  value: UnifiedMatch;
  meta: SourceMeta;
  firstSeenAt: string;
  conflicts: number;
}

const MAX_CONFLICTS = 200;

const globalForMatches = globalThis as unknown as {
  __koraMatchStore?: Map<string, StoredMatch>;
  __koraMatchConflicts?: Conflict[];
};

const store = globalForMatches.__koraMatchStore ?? (globalForMatches.__koraMatchStore = new Map());
const conflicts = globalForMatches.__koraMatchConflicts ?? (globalForMatches.__koraMatchConflicts = []);

/**
 * Is the provider's own timestamp trustworthy enough to compare?
 * A provider that omits it is treated as "now" — its data is what we just got.
 */
function incomingMeta(match: UnifiedMatch, source: string): SourceMeta {
  const parsed = Date.parse(match.lastUpdated ?? '');
  const updatedAt = Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
  return { source, priority: priorityOf(source), updatedAt };
}

/**
 * Reconcile a freshly fetched batch of matches with what we already know.
 * Returns the batch the app should display (never a regressed value) and records
 * conflicts internally.
 *
 * `trusted` marks provider-verified corrections (e.g. a postponed match being
 * rescheduled) which are allowed to move a status backwards.
 */
export function reconcileMatchBatch(
  matches: UnifiedMatch[],
  source: string,
  { trusted = false }: { trusted?: boolean } = {},
): UnifiedMatch[] {
  const out: UnifiedMatch[] = [];
  for (const match of matches) {
    out.push(reconcileOne(match, source, { trusted }));
  }
  return out;
}

export function reconcileOne(
  match: UnifiedMatch,
  source: string,
  { trusted = false }: { trusted?: boolean } = {},
): UnifiedMatch {
  const incoming = { ...match, provider: source };
  const stored = store.get(match.id) ?? null;

  if (!stored) {
    const issues: Issue[] = validateMatch(toValidatable(incoming));
    if (hasErrors(issues)) {
      recordConflict({
        code: 'invalid_first_record',
        detail: `${match.id}: ${issues.filter((i) => i.level === 'error').map((i) => i.code).join(',')}`,
        keptSource: null,
        rejectedSource: source,
      });
      return match;
    }
    store.set(match.id, {
      value: incoming,
      meta: incomingMeta(incoming, source),
      firstSeenAt: new Date().toISOString(),
      conflicts: 0,
    });
    return incoming;
  }

  const result = reconcileMatch(
    { ...toValidatable(stored.value), ...stored.meta },
    { ...toValidatable(incoming), ...incomingMeta(incoming, source) },
    { trustedCorrection: trusted },
  );

  if (!result.accepted) {
    stored.conflicts += 1;
    for (const conflict of result.conflicts) {
      recordConflict({
        ...conflict,
        detail: `${match.id}: ${conflict.detail}`,
      });
    }
    return stored.value;
  }

  // Accepted: merge the event timelines (union, never a downgrade to fewer events)
  // and keep the earliest first-seen timestamp for provenance.
  const merged: UnifiedMatch = {
    ...incoming,
    events: mergeEvents(stored.value.events, incoming.events),
  };
  const acceptedConflicts = result.conflicts.length;
  for (const conflict of result.conflicts) {
    recordConflict({ ...conflict, detail: `${match.id}: ${conflict.detail}` });
  }

  store.set(match.id, {
    value: merged,
    meta: incomingMeta(merged, source),
    firstSeenAt: stored.firstSeenAt,
    conflicts: stored.conflicts + acceptedConflicts,
  });
  return merged;
}

function toValidatable(match: UnifiedMatch) {
  return {
    id: match.id,
    status: match.status as MatchStatus,
    utcDate: match.utcDate,
    minute: match.minute,
    home: { id: match.home.id, name: match.home.name },
    away: { id: match.away.id, name: match.away.name },
    score: { home: match.score.home, away: match.score.away },
    lastUpdated: match.lastUpdated,
    provider: match.provider,
  };
}

export function recordConflict(conflict: Conflict): void {
  conflicts.unshift({ ...conflict, detail: conflict.detail.slice(0, 300) });
  if (conflicts.length > MAX_CONFLICTS) conflicts.length = MAX_CONFLICTS;
}

export function recentConflicts(limit = 50): Conflict[] {
  return conflicts.slice(0, Math.max(1, Math.min(limit, MAX_CONFLICTS)));
}

export function matchProvenance(matchId: string): MatchProvenance | null {
  const stored = store.get(matchId);
  if (!stored) return null;
  return {
    matchId,
    source: stored.meta.source,
    priority: stored.meta.priority,
    updatedAt: stored.meta.updatedAt,
    firstSeenAt: stored.firstSeenAt,
    stale: Date.now() - Date.parse(stored.meta.updatedAt) > 5 * 60 * 1000,
    conflicts: stored.conflicts,
  };
}

/**
 * Live matches that have stopped being updated — the classic "stuck live"
 * symptom of a provider silently failing. Reported by the diagnostics endpoint.
 */
export function stuckLiveMatches(now = Date.now(), thresholdMs = 25 * 60 * 1000): string[] {
  const stuck: string[] = [];
  for (const [id, stored] of store) {
    const match = stored.value;
    if (!isLiveStatus(match.status as MatchStatus)) continue;
    const updated = Date.parse(match.lastUpdated ?? '');
    if (!Number.isFinite(updated) || now - updated > thresholdMs) stuck.push(id);
  }
  return stuck;
}

/**
 * Knowledge of a match survives between requests so a page reload cannot be
 * served an older score just because a different node answered.
 */
export function cachedMatchSnapshot(id: string): UnifiedMatch | null {
  const stored = store.get(id);
  if (stored) return stored.value;
  const cached = cache.get<UnifiedMatch>(`match:${id}`);
  return cached?.value ?? null;
}

export function matchStoreStats(): { matches: number; conflicts: number } {
  return { matches: store.size, conflicts: conflicts.length };
}

/** Warm the store from a cached provider payload without re-deciding anything. */
export function hydrateFromCache(entries: { id: string; match: UnifiedMatch; source: string }[]): void {
  for (const entry of entries) {
    if (store.has(entry.id)) continue;
    const issues = validateMatch(toValidatable(entry.match));
    if (hasErrors(issues)) continue;
    store.set(entry.id, {
      value: entry.match,
      meta: incomingMeta(entry.match, entry.source),
      firstSeenAt: new Date().toISOString(),
      conflicts: 0,
    });
  }
}

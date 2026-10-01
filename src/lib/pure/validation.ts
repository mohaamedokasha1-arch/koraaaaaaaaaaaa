/**
 * Cross-source data validation and reconciliation (pure).
 *
 * The platform shows one match, one table, one truth per entity. Several
 * providers answer for the same fixture, so before any incoming record may
 * replace a stored one we verify:
 *
 *   1. the record is internally sane (no 12-3 score, no finished match with a
 *      null score, no kickoff in the year 2750, no 240th minute);
 *   2. the state machine allows the transition (scheduled → live → finished);
 *      nothing goes backwards without an explicit trusted correction;
 *   3. the incoming record is actually NEWER than what we have — a slow provider
 *      answering late must never overwrite fresher data (last-write-wins is the
 *      classic live-score bug this module exists to prevent).
 *
 * Conflicts are returned, never swallowed, so the caller can log them and keep
 * serving the safest value.
 */

export type MatchStatus =
  | 'scheduled'
  | 'live'
  | 'halftime'
  | 'finished'
  | 'postponed'
  | 'cancelled';

export interface ValidatableMatch {
  id: string;
  status: MatchStatus;
  utcDate: string;
  minute: number | null;
  home: { id: string; name: string };
  away: { id: string; name: string };
  score: { home: number | null; away: number | null };
  lastUpdated: string;
  provider: string;
}

export interface Issue {
  level: 'error' | 'warning';
  code: string;
  detail: string;
}

export interface Conflict {
  code: string;
  detail: string;
  keptSource: string | null;
  rejectedSource: string | null;
}

/** Legal status transitions for a fixture. */
const TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  scheduled: ['live', 'postponed', 'cancelled', 'finished'],
  live: ['halftime', 'finished', 'postponed', 'cancelled'],
  halftime: ['live', 'finished', 'postponed', 'cancelled'],
  finished: ['finished'],
  postponed: ['scheduled', 'cancelled'],
  cancelled: ['scheduled'],
};

export function canTransition(from: MatchStatus, to: MatchStatus): boolean {
  if (from === to) return true;
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function isLiveStatus(status: MatchStatus): boolean {
  return status === 'live' || status === 'halftime';
}

/** Sanity checks that do not depend on any other record. */
export function validateMatch(match: ValidatableMatch, now = Date.now()): Issue[] {
  const issues: Issue[] = [];
  const { home, away } = match.score;

  for (const [side, value] of [['home', home], ['away', away]] as const) {
    if (value != null && (!Number.isInteger(value) || value < 0 || value > 30)) {
      issues.push({ level: 'error', code: 'score_range', detail: `${side} score out of range: ${value}` });
    }
  }
  if (match.status === 'finished' && (home == null || away == null)) {
    issues.push({ level: 'error', code: 'finished_without_score', detail: 'finished match without a score' });
  }
  if (match.status === 'scheduled' && home != null && away != null) {
    issues.push({ level: 'warning', code: 'scheduled_with_score', detail: 'scheduled match carries a score' });
  }
  if (match.minute != null && (match.minute < 0 || match.minute > 130)) {
    issues.push({ level: 'error', code: 'minute_range', detail: `minute out of range: ${match.minute}` });
  }
  if (isLiveStatus(match.status) && match.minute == null) {
    issues.push({ level: 'warning', code: 'live_without_minute', detail: 'live match without a minute' });
  }

  const kickoff = Date.parse(match.utcDate);
  if (!Number.isFinite(kickoff)) {
    issues.push({ level: 'error', code: 'bad_kickoff', detail: `unparsable kickoff: ${match.utcDate}` });
  } else {
    const year = new Date(kickoff).getUTCFullYear();
    if (year < 1990 || year > new Date(now).getUTCFullYear() + 3) {
      issues.push({ level: 'error', code: 'kickoff_implausible', detail: `kickoff year ${year}` });
    }
  }

  if (!match.home?.id || !match.away?.id) {
    issues.push({ level: 'error', code: 'missing_team', detail: 'match without both team ids' });
  } else if (match.home.id === match.away.id) {
    issues.push({ level: 'error', code: 'same_team', detail: 'a team cannot play itself' });
  }

  const updated = Date.parse(match.lastUpdated);
  if (!Number.isFinite(updated)) {
    issues.push({ level: 'warning', code: 'bad_updated_at', detail: 'unparsable lastUpdated' });
  } else if (updated > now + 6 * 3600 * 1000) {
    issues.push({ level: 'warning', code: 'updated_in_future', detail: 'lastUpdated is in the future' });
  }
  return issues;
}

export function hasErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.level === 'error');
}

export interface SourceMeta {
  source: string;
  /** Higher wins ties (field-level priority, e.g. fd: 100, tsdb: 40). */
  priority: number;
  /** ISO timestamp of the upstream record's own freshness. */
  updatedAt: string;
}

/**
 * Is `incoming` strictly newer than `existing`? Ties are broken by source
 * priority, so two providers that both say "just now" still resolve
 * deterministically instead of flapping between values.
 */
export function isNewer(incoming: SourceMeta, existing: SourceMeta): boolean {
  const a = Date.parse(incoming.updatedAt);
  const b = Date.parse(existing.updatedAt);
  if (Number.isFinite(a) && Number.isFinite(b) && a !== b) return a > b;
  if (incoming.priority !== existing.priority) return incoming.priority > existing.priority;
  return false;
}

export interface ReconcileOptions {
  /** A human/provider-verified correction may legitimately move a match backwards. */
  trustedCorrection?: boolean;
}

export interface ReconcileResult<T> {
  accepted: boolean;
  value: T;
  conflicts: Conflict[];
  issues: Issue[];
  reason: 'accepted' | 'invalid' | 'stale_write' | 'illegal_transition' | 'accepted_correction';
}

/**
 * Decide whether an incoming match may replace the stored one.
 * The stored value is always returned when the incoming record is rejected —
 * rejecting never destroys data.
 */
export function reconcileMatch<T extends ValidatableMatch>(
  existing: (T & SourceMeta) | null,
  incoming: T & SourceMeta,
  options: ReconcileOptions = {},
): ReconcileResult<T> {
  const issues = validateMatch(incoming);
  if (hasErrors(issues)) {
    return {
      accepted: false,
      value: (existing ?? incoming) as T,
      conflicts: [
        {
          code: 'invalid_incoming',
          detail: issues.filter((i) => i.level === 'error').map((i) => i.code).join(','),
          keptSource: existing?.source ?? null,
          rejectedSource: incoming.source,
        },
      ],
      issues,
      reason: 'invalid',
    };
  }

  if (!existing) {
    return { accepted: true, value: incoming, conflicts: [], issues, reason: 'accepted' };
  }

  const conflicts: Conflict[] = [];

  if (!canTransition(existing.status, incoming.status)) {
    if (!options.trustedCorrection) {
      conflicts.push({
        code: 'illegal_transition',
        detail: `${existing.status} → ${incoming.status}`,
        keptSource: existing.source,
        rejectedSource: incoming.source,
      });
      return { accepted: false, value: existing, conflicts, issues, reason: 'illegal_transition' };
    }
    conflicts.push({
      code: 'correction_applied',
      detail: `${existing.status} → ${incoming.status} (trusted correction)`,
      keptSource: null,
      rejectedSource: null,
    });
  }

  const existingMeta: SourceMeta = { source: existing.source, priority: existing.priority, updatedAt: existing.updatedAt };
  const incomingMeta: SourceMeta = { source: incoming.source, priority: incoming.priority, updatedAt: incoming.updatedAt };

  if (!options.trustedCorrection && !isNewer(incomingMeta, existingMeta)) {
    conflicts.push({
      code: 'stale_write_blocked',
      detail: `incoming ${incoming.source} is not newer than ${existing.source}`,
      keptSource: existing.source,
      rejectedSource: incoming.source,
    });
    return { accepted: false, value: existing, conflicts, issues, reason: 'stale_write' };
  }

  return {
    accepted: true,
    value: incoming,
    conflicts,
    issues,
    reason: options.trustedCorrection && conflicts.length > 0 ? 'accepted_correction' : 'accepted',
  };
}

/**
 * Field-level priority: when two providers both have the data, the higher
 * priority source wins THAT FIELD (one provider may be best for scores while
 * another is the only one with a crest). Empty values never displace a filled
 * one, which is what stops a partial provider from blanking a good record.
 */
export interface FieldCandidate<T> {
  value: T | null | undefined;
  source: string;
  priority: number;
  updatedAt: string;
}

export function pickField<T>(
  candidates: FieldCandidate<T>[],
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
): { value: T | null; source: string | null } {
  const usable = candidates.filter((c) => c.value != null || allowEmpty);
  if (usable.length === 0) return { value: null, source: null };
  usable.sort((a, b) => {
    const aEmpty = a.value == null ? 1 : 0;
    const bEmpty = b.value == null ? 1 : 0;
    if (aEmpty !== bEmpty) return aEmpty - bEmpty;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
  const winner = usable[0];
  return { value: (winner.value ?? null) as T | null, source: winner.source };
}

/**
 * Is a match "stuck"? A live match whose data has not moved for a long time is
 * almost always a provider that stopped sending updates — surfacing it lets the
 * UI mark the score as possibly outdated instead of silently lying.
 */
export function isStuckLive(match: ValidatableMatch, now = Date.now(), thresholdMs = 25 * 60 * 1000): boolean {
  if (!isLiveStatus(match.status)) return false;
  const updated = Date.parse(match.lastUpdated);
  if (!Number.isFinite(updated)) return true;
  return now - updated > thresholdMs;
}

/** Merge two event lists without duplicating the same real-world event. */
export interface ComparableEvent {
  type: string;
  minute: number | null;
  extraMinute?: number | null;
  player?: string | null;
  assist?: string | null;
  teamId?: string | null;
}

export function eventKey(event: ComparableEvent): string {
  return [
    event.type,
    event.minute ?? '',
    event.extraMinute ?? '',
    (event.player ?? '').toLowerCase(),
    (event.assist ?? '').toLowerCase(),
    event.teamId ?? '',
  ].join('|');
}

export function mergeEvents<T extends ComparableEvent>(a: T[], b: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const event of [...a, ...b]) {
    const key = eventKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(event);
  }
  return out.sort((x, y) => (x.minute ?? 999) - (y.minute ?? 999));
}

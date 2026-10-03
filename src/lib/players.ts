import type { Scorer, SquadPlayer, UnifiedTeam } from './types.ts';
import { slugify } from './pure/entity.ts';

/**
 * Player identity model.
 *
 * There is deliberately NO global player database or player search in this
 * codebase. A real test during this session proved why: TheSportsDB's free
 * player search returned a wrong current club for a world-famous player
 * (and its squad list assigned another well-known player to the wrong club
 * too). Fabricating — or trusting an unreliable source for — "who plays
 * where" violates the project's zero-fake-data rule, so it is not used.
 *
 * Instead, a player page is only ever reached FROM a team's own (verified,
 * provider-fresh) squad list or a league's top-scorers list — both already
 * reliable, already-used data. The player's id is therefore composite and
 * self-describing: "<teamEntityId>~<personId>", e.g. "fd~65~44". Resolving
 * it means: load that exact team (the normal, cached getTeam call) and find
 * the matching person inside its CURRENT squad. No independent player
 * entity, no cross-provider merge, no stale cache of "current club".
 */

/**
 * Builds a self-describing, SEO-friendly player route id:
 * "<name-slug>~<provider>~<teamProviderId>~<personId>", e.g.
 * "mohamed-salah~fd~64~3754". The leading slug is cosmetic only (never
 * trusted on decode); the trailing three segments are what actually resolve
 * the page, exactly mirroring how team ids already work ("fd~64").
 */
export function playerEntityId(playerName: string, teamId: string, personId: string): string {
  return `${slugify(playerName)}~${teamId}~${personId}`;
}

export function decodePlayerId(id: string): { teamId: string; personId: string } | null {
  const segments = id.split('~').filter(Boolean);
  // Team ids are always "<provider>~<providerId>" (2 segments); the last
  // segment is the person id. Any leading segments are an ignored cosmetic
  // slug. Anything shorter than 3 total segments cannot address a real team.
  if (segments.length < 3) return null;
  const personId = segments[segments.length - 1];
  const teamId = `${segments[segments.length - 3]}~${segments[segments.length - 2]}`;
  if (!personId || !teamId) return null;
  return { teamId, personId };
}

export interface PlayerProfile {
  player: SquadPlayer;
  team: UnifiedTeam;
  stats: Pick<Scorer, 'goals' | 'assists' | 'penalties' | 'played'> | null;
}

/** Find the player inside a team's current squad — never fabricated. */
export function findPlayerInTeam(team: UnifiedTeam, personId: string): SquadPlayer | null {
  return team.squad.find((p) => p.id === personId) ?? null;
}

export function ageFromBirthDate(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  const dob = new Date(iso);
  if (Number.isNaN(dob.getTime())) return null;
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 100 ? age : null;
}

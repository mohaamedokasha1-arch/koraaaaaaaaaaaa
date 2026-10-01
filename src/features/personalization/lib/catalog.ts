import 'server-only';
import type { EntityRecord } from '@/lib/pure/entity';
import type { Scorer, SquadPlayer, UnifiedTeam } from '@/lib/types';
import { cache } from '@/lib/cache';
import { ALL_LEAGUES } from '@/lib/constants';
import { entitiesByKind, getEntity, slugForTeam } from '@/lib/entities';
import {
  isLeagueCode, isProviderTeamId, parseFavorite,
  type Favorite, type FavoriteCatalog, type FavoriteOption,
} from './preferences';

export function favoriteForEntity(entity: EntityRecord, providerId?: string | null): Favorite | null {
  if (entity.kind !== 'team') return null;
  const refOrder = ['fd', 'af', 'tsdb', 'espn'];
  const ref = providerId ?? [...entity.refs].filter((entry) => isProviderTeamId(entry.id))
    .sort((a, b) => refOrder.indexOf(a.id.split('~')[0]) - refOrder.indexOf(b.id.split('~')[0]))[0]?.id ?? null;
  return parseFavorite({
    kind: 'team', id: entity.id, slug: entity.slug, name: entity.name,
    nameAr: entity.nameAr, country: entity.country, crest: entity.crest,
    providerId: isProviderTeamId(ref) ? ref : null,
    leagueCode: entity.leagueCodes.find(isLeagueCode) ?? null,
  });
}

/** Build buttons only from the same provider/registry payload the page displays. */
export function favoriteForTeam(team: Pick<UnifiedTeam, 'id' | 'name' | 'crest'> & { country?: string | null }, leagueCode?: string | null): Favorite | null {
  const providerId = isProviderTeamId(team.id) ? team.id : null;
  const slug = slugForTeam(team, providerId?.split('~')[0], leagueCode);
  const entity = getEntity(slug);
  const favorite = entity ? favoriteForEntity(entity, providerId) : null;
  return favorite ? { ...favorite, crest: parseFavorite({ ...favorite, crest: team.crest })?.crest ?? null } : null;
}

export function favoriteForLeague(code: string): Favorite | null {
  const league = ALL_LEAGUES.find((entry) => entry.fdCode === code);
  if (!league) return null;
  return parseFavorite({
    kind: 'league', id: `league:${code.toLowerCase()}`, name: league.nameEn,
    nameAr: league.nameAr, country: league.country, crest: league.emblem,
    leagueCode: code,
  });
}

export function favoriteForSquadPlayer(player: SquadPlayer, team: Pick<UnifiedTeam, 'id' | 'name' | 'crest' | 'leagueCode'>): Favorite | null {
  if (!player.id || !isProviderTeamId(team.id)) return null;
  const providerId = `${team.id.split('~')[0]}~${player.id}`;
  return parseFavorite({
    kind: 'player', id: `player:${providerId}`, providerId, name: player.name,
    country: player.nationality, teamId: team.id, teamName: team.name,
    crest: team.crest, leagueCode: isLeagueCode(team.leagueCode) ? team.leagueCode : null,
    origin: 'squad',
  });
}

export function favoriteForScorer(scorer: Scorer, leagueCode?: string): Favorite | null {
  if (!scorer.playerId || !isProviderTeamId(scorer.team.id) || !isLeagueCode(leagueCode)) return null;
  const providerId = `${scorer.team.id.split('~')[0]}~${scorer.playerId}`;
  return parseFavorite({
    kind: 'player', id: `player:${providerId}`, providerId, name: scorer.name,
    teamId: scorer.team.id, teamName: scorer.team.name, crest: scorer.team.crest,
    leagueCode, origin: 'scorers',
  });
}

/** No provider calls. Existing catalogue plus actual, already-cached players. */
export function getFavoriteCatalog(): FavoriteCatalog {
  const teams = entitiesByKind('team').map((entity): FavoriteOption | null => {
    const favorite = favoriteForEntity(entity);
    return favorite ? { favorite, searchTerms: [entity.name, entity.nameAr ?? '', entity.country ?? '', ...entity.aliases] } : null;
  }).filter((entry): entry is FavoriteOption => entry !== null)
    .sort((a, b) => Number(b.favorite.country === 'Egypt') - Number(a.favorite.country === 'Egypt') || a.favorite.name.localeCompare(b.favorite.name))
    .slice(0, 120);
  const leagues = ALL_LEAGUES.map((league) => ({
    favorite: favoriteForLeague(league.fdCode)!,
    searchTerms: [league.nameEn, league.nameAr, league.fdCode, league.country, league.countryAr],
  }));
  const players = new Map<string, FavoriteOption>();
  function add(favorite: Favorite | null) {
    if (favorite && players.size < 100) players.set(favorite.id, {
      favorite, searchTerms: [favorite.name, favorite.teamName ?? '', favorite.country ?? ''],
    });
  }
  for (const key of cache.keysWithPrefix('team:')) {
    const team = cache.get<UnifiedTeam>(key)?.value;
    if (team) for (const player of team.squad) add(favoriteForSquadPlayer(player, team));
    if (players.size >= 100) break;
  }
  for (const key of cache.keysWithPrefix('scorers:')) {
    const scorers = cache.get<Scorer[]>(key)?.value;
    if (scorers) for (const scorer of scorers) add(favoriteForScorer(scorer, key.slice('scorers:'.length)));
    if (players.size >= 100) break;
  }
  return { team: teams, league: leagues, player: [...players.values()] };
}

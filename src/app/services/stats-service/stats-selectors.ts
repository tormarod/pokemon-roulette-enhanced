import { PlayerStats } from '../../interfaces/player-stats';
import { PokemonType } from '../../interfaces/pokemon-type';
import { BattleType } from './stats.service';

export interface TopEntry {
  pokemonId: number;
  count: number;
}

export interface TypeEntry {
  type: PokemonType;
  count: number;
}

export interface NemesisEntry {
  /** The raw `${battleType}:${name}` key stats are keyed by — see StatsService.recordBattleLoss. */
  key: string;
  battleType: BattleType;
  /** The opponent's i18n name key (e.g. `gym.brock.name`), not display text. */
  name: string;
  count: number;
}

export interface BattleTypeRates {
  gym: number | null;
  rival: number | null;
  eliteFour: number | null;
  champion: number | null;
}

/**
 * Everything the UI needs to render the stats screen, derived at read time
 * from PlayerStats's raw counters — nothing here is persisted (plan §3).
 */
export interface PlayerStatsSummary {
  runsPlayed: number;
  victories: number;
  defeats: number;
  winRate: number | null;
  currentStreak: number;
  bestWinStreak: number;
  gymLeadersDefeated: number;
  eliteFourDefeated: number;
  championsDefeated: number;
  pokemonCaught: number;
  shiniesCaught: number;
  fastestVictoryRounds: number | null;
  longestRunRounds: number;
  favoriteGenerationId: number | null;
  topOwnedPokemon: TopEntry[];
  mostChosenStarterId: number | null;
  /** Species present in the most victorious runs — see plan §4 "Signature Pokémon". */
  signaturePokemonId: number | null;
  /** All types the player has fielded, most-used first. */
  favoriteTypes: TypeEntry[];
  /** The opponent that has ended the most runs, or null with no defeats yet. */
  nemesis: NemesisEntry | null;
  battleTypeWinRates: BattleTypeRates;
  /** Share of all defeats that happened at the Champion specifically — the "heartbreak counter". */
  championHeartbreakRate: number | null;
}

const TOP_OWNED_COUNT = 3;

export function computeStatsSummary(stats: PlayerStats): PlayerStatsSummary {
  return {
    runsPlayed: stats.runsPlayed,
    victories: stats.victories,
    defeats: stats.defeats,
    winRate: rate(stats.victories, stats.runsPlayed),
    currentStreak: stats.currentStreak,
    bestWinStreak: stats.bestWinStreak,
    gymLeadersDefeated: stats.gymLeadersDefeated,
    eliteFourDefeated: stats.eliteFourDefeated,
    championsDefeated: stats.championsDefeated,
    pokemonCaught: stats.pokemonCaught,
    shiniesCaught: stats.shiniesCaught,
    fastestVictoryRounds: stats.fastestVictoryRounds,
    longestRunRounds: stats.longestRunRounds,
    favoriteGenerationId: topNumericKey(stats.generationPlayCounts),
    topOwnedPokemon: topEntries(stats.speciesOwnedCounts, TOP_OWNED_COUNT),
    mostChosenStarterId: topNumericKey(stats.starterCounts),
    signaturePokemonId: topNumericKey(stats.speciesVictoryCounts),
    favoriteTypes: topTypeEntries(stats.typeCounts),
    nemesis: topNemesis(stats.nemesisDefeats),
    battleTypeWinRates: {
      gym: rate(stats.battleTypeWins.gym, stats.battleTypeWins.gym + stats.battleTypeLosses.gym),
      rival: rate(stats.battleTypeWins.rival, stats.battleTypeWins.rival + stats.battleTypeLosses.rival),
      eliteFour: rate(stats.battleTypeWins.eliteFour, stats.battleTypeWins.eliteFour + stats.battleTypeLosses.eliteFour),
      champion: rate(stats.battleTypeWins.champion, stats.battleTypeWins.champion + stats.battleTypeLosses.champion),
    },
    championHeartbreakRate: rate(stats.battleTypeLosses.champion, stats.defeats),
  };
}

/** wins/total as a 0-1 fraction, or null when there's nothing to divide by yet (no empty-history NaN/Infinity). */
function rate(part: number, total: number): number | null {
  return total > 0 ? part / total : null;
}

/**
 * Highest count first; ties broken by ascending pokemonId so results are
 * deterministic rather than depending on object key insertion order.
 */
function topEntries(record: Record<number, number>, n: number): TopEntry[] {
  return Object.entries(record)
    .map(([id, count]) => ({ pokemonId: Number(id), count }))
    .sort((a, b) => b.count - a.count || a.pokemonId - b.pokemonId)
    .slice(0, n);
}

function topNumericKey(record: Record<number, number>): number | null {
  return topEntries(record, 1)[0]?.pokemonId ?? null;
}

/** Ties broken alphabetically by type name for determinism. */
function topTypeEntries(record: Partial<Record<PokemonType, number>>): TypeEntry[] {
  return (Object.entries(record) as [PokemonType, number][])
    .sort(([typeA, countA], [typeB, countB]) => countB - countA || typeA.localeCompare(typeB))
    .map(([type, count]) => ({ type, count }));
}

/** Ties broken alphabetically by opponent key for determinism. */
function topNemesis(record: Record<string, number>): NemesisEntry | null {
  const entries = Object.entries(record).sort(([keyA, countA], [keyB, countB]) => countB - countA || keyA.localeCompare(keyB));
  if (entries.length === 0) {
    return null;
  }

  const [key, count] = entries[0];
  const separatorIndex = key.indexOf(':');
  const battleType = (separatorIndex === -1 ? key : key.slice(0, separatorIndex)) as BattleType;
  const name = separatorIndex === -1 ? '' : key.slice(separatorIndex + 1);
  return { key, battleType, name, count };
}

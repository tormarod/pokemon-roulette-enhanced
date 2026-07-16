import { PokemonType } from './pokemon-type';

/** Bump when the shape changes; migratePlayerStats() must handle every prior version. */
export const PLAYER_STATS_VERSION = 1;

export interface BattleTypeCounts {
  gym: number;
  rival: number;
  eliteFour: number;
  champion: number;
}

/**
 * Lifetime, cross-run player statistics. Persisted independently of
 * RunPersistenceService's run blob and never cleared by it — see
 * docs/plans/statistics-section.md. Raw counters only; "top N", rates and
 * streak summaries are derived at render time, not stored here.
 */
export interface PlayerStats {
  version: number;

  // Lifetime totals
  runsPlayed: number;
  victories: number;
  defeats: number;
  /** Positive = current win streak, negative = current loss streak, 0 = none yet. */
  currentStreak: number;
  bestWinStreak: number;
  gymLeadersDefeated: number;
  eliteFourDefeated: number;
  championsDefeated: number;
  pokemonCaught: number;
  shiniesCaught: number;

  // Records
  fastestVictoryRounds: number | null;
  longestRunRounds: number;
  /** Keyed by GenerationItem.id. */
  generationPlayCounts: Record<number, number>;

  // Pokémon-centric ("fun" tier)
  /** Keyed by PokemonItem.pokemonId — see §8.2 of the plan for the "owned" definition. */
  speciesOwnedCounts: Record<number, number>;
  /** Keyed by PokemonItem.pokemonId; incremented once per victorious run the species was owned in. */
  speciesVictoryCounts: Record<number, number>;
  /** Keyed by PokemonItem.pokemonId. */
  starterCounts: Record<number, number>;
  typeCounts: Partial<Record<PokemonType, number>>;

  // Nemesis / battle
  /** Keyed by a stable opponent id (e.g. `${battleType}:${name}`) — count of runs that opponent ended. */
  nemesisDefeats: Record<string, number>;
  battleTypeWins: BattleTypeCounts;
  battleTypeLosses: BattleTypeCounts;
}

export function createDefaultPlayerStats(): PlayerStats {
  return {
    version: PLAYER_STATS_VERSION,
    runsPlayed: 0,
    victories: 0,
    defeats: 0,
    currentStreak: 0,
    bestWinStreak: 0,
    gymLeadersDefeated: 0,
    eliteFourDefeated: 0,
    championsDefeated: 0,
    pokemonCaught: 0,
    shiniesCaught: 0,
    fastestVictoryRounds: null,
    longestRunRounds: 0,
    generationPlayCounts: {},
    speciesOwnedCounts: {},
    speciesVictoryCounts: {},
    starterCounts: {},
    typeCounts: {},
    nemesisDefeats: {},
    battleTypeWins: { gym: 0, rival: 0, eliteFour: 0, champion: 0 },
    battleTypeLosses: { gym: 0, rival: 0, eliteFour: 0, champion: 0 },
  };
}

/**
 * Merges a parsed (possibly older or partial) blob onto a fresh default,
 * field by field, so a player's history survives new fields being added
 * later without a migration step — mirrors SavedRun's defaulting pattern
 * but per-field instead of all-or-nothing, since this schema is expected to
 * grow over time.
 */
export function normalizePlayerStats(value: unknown): PlayerStats {
  const defaults = createDefaultPlayerStats();
  if (!value || typeof value !== 'object') {
    return defaults;
  }

  const partial = value as Partial<PlayerStats>;
  return {
    version: PLAYER_STATS_VERSION,
    runsPlayed: numberOr(partial.runsPlayed, defaults.runsPlayed),
    victories: numberOr(partial.victories, defaults.victories),
    defeats: numberOr(partial.defeats, defaults.defeats),
    currentStreak: numberOr(partial.currentStreak, defaults.currentStreak),
    bestWinStreak: numberOr(partial.bestWinStreak, defaults.bestWinStreak),
    gymLeadersDefeated: numberOr(partial.gymLeadersDefeated, defaults.gymLeadersDefeated),
    eliteFourDefeated: numberOr(partial.eliteFourDefeated, defaults.eliteFourDefeated),
    championsDefeated: numberOr(partial.championsDefeated, defaults.championsDefeated),
    pokemonCaught: numberOr(partial.pokemonCaught, defaults.pokemonCaught),
    shiniesCaught: numberOr(partial.shiniesCaught, defaults.shiniesCaught),
    fastestVictoryRounds: typeof partial.fastestVictoryRounds === 'number' ? partial.fastestVictoryRounds : defaults.fastestVictoryRounds,
    longestRunRounds: numberOr(partial.longestRunRounds, defaults.longestRunRounds),
    generationPlayCounts: recordOr(partial.generationPlayCounts, defaults.generationPlayCounts),
    speciesOwnedCounts: recordOr(partial.speciesOwnedCounts, defaults.speciesOwnedCounts),
    speciesVictoryCounts: recordOr(partial.speciesVictoryCounts, defaults.speciesVictoryCounts),
    starterCounts: recordOr(partial.starterCounts, defaults.starterCounts),
    typeCounts: recordOr(partial.typeCounts, defaults.typeCounts),
    nemesisDefeats: recordOr(partial.nemesisDefeats, defaults.nemesisDefeats),
    battleTypeWins: battleTypeCountsOr(partial.battleTypeWins, defaults.battleTypeWins),
    battleTypeLosses: battleTypeCountsOr(partial.battleTypeLosses, defaults.battleTypeLosses),
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function recordOr<T extends Record<string, unknown>>(value: unknown, fallback: T): T {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...fallback, ...value as T } : fallback;
}

function battleTypeCountsOr(value: unknown, fallback: BattleTypeCounts): BattleTypeCounts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }
  return { ...fallback, ...value as Partial<BattleTypeCounts> };
}

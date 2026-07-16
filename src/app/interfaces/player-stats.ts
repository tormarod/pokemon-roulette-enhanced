import { PokemonType } from './pokemon-type';

/** Bump when the shape changes; migratePlayerStats() must handle every prior version. */
export const PLAYER_STATS_VERSION = 1;

export interface BattleTypeCounts {
  gym: number;
  rival: number;
  eliteFour: number;
  champion: number;
}

/** Max entries kept in PlayerStats.runHistory — oldest dropped past this (plan V2 §3.C). */
export const RUN_HISTORY_CAP = 30;

/** One completed run's summary, appended to PlayerStats.runHistory at recordRunEnd. */
export interface RunLogEntry {
  victory: boolean;
  generationId: number;
  roundsReached: number;
  starterPokemonId: number;
  startedAt: number;
  endedAt: number;
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

  // Luck / wheel (V2 Group A)
  totalSpins: number;
  yesLandings: number;
  /** Sum of each spin's pre-spin yes-share (yesTickets/totalTickets) — the denominator for the expected win rate. */
  sumExpectedYesProbability: number;
  potionsUsed: number;
  teamRocketStealsSuffered: number;

  // Run-history log (V2 Group C) + playtime timestamps (V2 Group D)
  /** Capped at RUN_HISTORY_CAP entries, oldest dropped first. */
  runHistory: RunLogEntry[];
  firstPlayedAt: number | null;
  lastPlayedAt: number | null;

  // Data-gap fills (V2 Group D, remainder) + achievements (V2 Group B)
  legendariesCaught: number;
  evolutionsPerformed: number;
  /** Runs won with zero battle losses (gym/rival/eliteFour/champion combined) along the way. */
  perfectRuns: number;
  /** Keyed by GenerationItem.id; true once the champion has been defeated in that generation. */
  championGenerationIds: Record<number, boolean>;
  /** Keyed by Achievement.id — see achievements.ts. */
  unlockedAchievementIds: Record<string, boolean>;
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
    totalSpins: 0,
    yesLandings: 0,
    sumExpectedYesProbability: 0,
    potionsUsed: 0,
    teamRocketStealsSuffered: 0,
    runHistory: [],
    firstPlayedAt: null,
    lastPlayedAt: null,
    legendariesCaught: 0,
    evolutionsPerformed: 0,
    perfectRuns: 0,
    championGenerationIds: {},
    unlockedAchievementIds: {},
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
    totalSpins: numberOr(partial.totalSpins, defaults.totalSpins),
    yesLandings: numberOr(partial.yesLandings, defaults.yesLandings),
    sumExpectedYesProbability: numberOr(partial.sumExpectedYesProbability, defaults.sumExpectedYesProbability),
    potionsUsed: numberOr(partial.potionsUsed, defaults.potionsUsed),
    teamRocketStealsSuffered: numberOr(partial.teamRocketStealsSuffered, defaults.teamRocketStealsSuffered),
    runHistory: runHistoryOr(partial.runHistory, defaults.runHistory),
    firstPlayedAt: nullableNumberOr(partial.firstPlayedAt, defaults.firstPlayedAt),
    lastPlayedAt: nullableNumberOr(partial.lastPlayedAt, defaults.lastPlayedAt),
    legendariesCaught: numberOr(partial.legendariesCaught, defaults.legendariesCaught),
    evolutionsPerformed: numberOr(partial.evolutionsPerformed, defaults.evolutionsPerformed),
    perfectRuns: numberOr(partial.perfectRuns, defaults.perfectRuns),
    championGenerationIds: recordOr(partial.championGenerationIds, defaults.championGenerationIds),
    unlockedAchievementIds: recordOr(partial.unlockedAchievementIds, defaults.unlockedAchievementIds),
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

function nullableNumberOr(value: unknown, fallback: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isValidRunLogEntry(value: unknown): value is RunLogEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const entry = value as Partial<RunLogEntry>;
  return typeof entry.victory === 'boolean'
    && typeof entry.generationId === 'number'
    && typeof entry.roundsReached === 'number'
    && typeof entry.starterPokemonId === 'number'
    && typeof entry.startedAt === 'number'
    && typeof entry.endedAt === 'number';
}

/** Drops malformed entries rather than discarding the whole log, then re-applies the cap. */
function runHistoryOr(value: unknown, fallback: RunLogEntry[]): RunLogEntry[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value.filter(isValidRunLogEntry).slice(-RUN_HISTORY_CAP);
}

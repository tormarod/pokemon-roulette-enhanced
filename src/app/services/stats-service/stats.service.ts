import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable, Subject } from 'rxjs';
import { BattleTypeCounts, createDefaultPlayerStats, normalizePlayerStats, PlayerStats, RUN_HISTORY_CAP, RunLogEntry } from '../../interfaces/player-stats';
import { Achievement } from '../../interfaces/achievement';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { PokemonType } from '../../interfaces/pokemon-type';
import { ACHIEVEMENTS } from './achievements';
import { TrainerService } from '../trainer-service/trainer.service';
import { computeStatsSummary, computeGenerationStatsSummary, PlayerStatsSummary, PlayerGenerationStatsSummary } from './stats-selectors';

export type BattleType = keyof BattleTypeCounts;

const BATTLES_WON_COUNTER: Partial<Record<BattleType, keyof PlayerStats>> = {
  gym: 'gymLeadersDefeated',
  eliteFour: 'eliteFourDefeated',
  champion: 'championsDefeated',
};

/**
 * Lifetime player statistics store. Separate localStorage key from
 * RunPersistenceService's run blob — see docs/plans/statistics-section.md §3.
 * Never cleared by a run ending; only by an explicit reset().
 */
@Injectable({
  providedIn: 'root'
})
export class StatsService {
  private readonly STATS_STORAGE_KEY = 'pokemon-roulette-stats';

  private readonly statsSubject: BehaviorSubject<PlayerStats>;

  /**
   * Species (team + storage) seen at any point during the run in progress —
   * "owned" per run counts a species once even if caught/evolved/traded in
   * mid-run, not just what's on the team at the end (plan §8.2). Kept in
   * memory only: cosmetic stats don't need reload-proofing (plan §3), so a
   * lost mid-run reload just undercounts a "fun" stat, never a gameplay one.
   */
  private currentRunSpeciesSeen = new Set<number>();

  /**
   * In-progress run's start timing/context, captured at recordRunStart and
   * consumed at recordRunEnd to build the RunLogEntry — recordRunEnd only
   * receives (victory, roundsReached), not the generation/starter/start time.
   * Memory-only like currentRunSpeciesSeen: a lost mid-run reload just means
   * no log entry for that run, never a gameplay-affecting loss (plan §3).
   */
  private currentRunStartedAt: number | null = null;
  private currentRunGenerationId: number | null = null;
  private currentRunStarterPokemonId: number | null = null;

  /** Count of battle losses (any type) so far this run — zero at recordRunEnd means a "perfect run". */
  private currentRunBattleLossCount = 0;

  private readonly achievementUnlockedSubject = new Subject<Achievement>();

  constructor(private trainerService: TrainerService) {
    this.statsSubject = new BehaviorSubject<PlayerStats>(this.loadStats());

    this.trainerService.getTeamObservable().subscribe(() => {
      for (const pokemon of this.trainerService.getTeam()) {
        this.currentRunSpeciesSeen.add(pokemon.pokemonId);
      }
      for (const pokemon of this.trainerService.getStored()) {
        this.currentRunSpeciesSeen.add(pokemon.pokemonId);
      }
    });
  }

  get current(): PlayerStats {
    return this.statsSubject.value;
  }

  getStatsObservable(): Observable<PlayerStats> {
    return this.statsSubject.asObservable();
  }

  getSummary(): PlayerStatsSummary {
    return computeStatsSummary(this.current);
  }

  getSummaryObservable(): Observable<PlayerStatsSummary> {
    return this.statsSubject.pipe(map(computeStatsSummary));
  }

  /** Per-generation view (plan V3 §4) — 'all' generations' derivation stays computeStatsSummary above, unchanged. */
  getGenerationSummaryObservable(generationId: number): Observable<PlayerGenerationStatsSummary> {
    return this.statsSubject.pipe(map(stats => computeGenerationStatsSummary(stats, generationId)));
  }

  /** Emits each Achievement the moment it's newly unlocked — for a toast (plan V2 §7.2). */
  getAchievementUnlockedObservable(): Observable<Achievement> {
    return this.achievementUnlockedSubject.asObservable();
  }

  reset(): void {
    this.currentRunSpeciesSeen = new Set();
    this.persist(createDefaultPlayerStats());
  }

  /**
   * Per-section resets (plan V2 §3.E / §7 — V1 only had reset-all). These
   * `persist()` directly rather than going through `update()`, so clearing
   * `unlockedAchievementIds` doesn't immediately re-trigger every achievement
   * whose underlying counters still satisfy its predicate.
   */
  resetLuckStats(): void {
    this.persist({
      ...this.current,
      totalSpins: 0,
      yesLandings: 0,
      sumExpectedYesProbability: 0,
      potionsUsed: 0,
      teamRocketStealsSuffered: 0,
    });
  }

  resetRunHistory(): void {
    this.persist({ ...this.current, runHistory: [] });
  }

  resetAchievements(): void {
    this.persist({ ...this.current, unlockedAchievementIds: {} });
  }

  /** Serializes the full current PlayerStats blob for local backup (plan V2 §7.5). */
  exportStats(): string {
    return JSON.stringify(this.current, null, 2);
  }

  /**
   * Parses and normalizes a previously-exported blob, replacing current
   * stats wholesale. Goes through `update()` (not a direct `persist()`) so a
   * newer app version's achievements can unlock against imported progress.
   * Returns false (leaving current stats untouched) on invalid JSON.
   */
  importStats(json: string): boolean {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return false;
    }
    this.update(() => normalizePlayerStats(parsed));
    return true;
  }

  /** Call once, at the moment a new run's starter is captured. */
  recordRunStart(generationId: number, starterPokemonId: number): void {
    this.currentRunSpeciesSeen = new Set();
    this.currentRunStartedAt = this.now();
    this.currentRunGenerationId = generationId;
    this.currentRunStarterPokemonId = starterPokemonId;
    this.currentRunBattleLossCount = 0;

    this.update(stats => ({
      ...stats,
      runsPlayed: stats.runsPlayed + 1,
      generationPlayCounts: incrementRecord(stats.generationPlayCounts, generationId),
      starterCounts: incrementRecord(stats.starterCounts, starterPokemonId),
      firstPlayedAt: stats.firstPlayedAt ?? this.currentRunStartedAt,
    }));
  }

  recordCapture(): void {
    this.update(stats => ({ ...stats, pokemonCaught: stats.pokemonCaught + 1 }));
  }

  recordShiny(): void {
    this.update(stats => ({ ...stats, shiniesCaught: stats.shiniesCaught + 1 }));
  }

  /** Call for both a legendary and a Paradox capture (plan V2 §3.D). */
  recordLegendaryCaught(): void {
    this.update(stats => ({ ...stats, legendariesCaught: stats.legendariesCaught + 1 }));
  }

  recordEvolutionPerformed(): void {
    this.update(stats => ({ ...stats, evolutionsPerformed: stats.evolutionsPerformed + 1 }));
  }

  /**
   * Call once per wheel spin on a Yes/No battle roulette, right before the
   * spin resolves. `expectedProbability` is the pre-spin yes-share
   * (yesTickets/totalTickets) — the luck index compares the actual yes-rate
   * against the average of these expectations (see computeStatsSummary).
   */
  recordSpin(landedYes: boolean, expectedProbability: number): void {
    this.update(stats => ({
      ...stats,
      totalSpins: stats.totalSpins + 1,
      yesLandings: landedYes ? stats.yesLandings + 1 : stats.yesLandings,
      sumExpectedYesProbability: stats.sumExpectedYesProbability + expectedProbability,
    }));
  }

  recordPotionUsed(): void {
    this.update(stats => ({ ...stats, potionsUsed: stats.potionsUsed + 1 }));
  }

  recordStealSuffered(): void {
    this.update(stats => ({ ...stats, teamRocketStealsSuffered: stats.teamRocketStealsSuffered + 1 }));
  }

  /**
   * `generationId` should only be passed for a champion win — it feeds the
   * "champion in every generation" achievement (see achievements.ts) and is
   * ignored for every other battle type.
   */
  recordBattleWin(battleType: BattleType, generationId?: number): void {
    this.update(stats => {
      const next: PlayerStats = {
        ...stats,
        battleTypeWins: { ...stats.battleTypeWins, [battleType]: stats.battleTypeWins[battleType] + 1 },
      };
      const counterField = BATTLES_WON_COUNTER[battleType];
      if (counterField) {
        (next[counterField] as number) = (stats[counterField] as number) + 1;
      }
      if (battleType === 'champion' && generationId !== undefined) {
        next.championGenerationIds = { ...stats.championGenerationIds, [generationId]: true };
      }
      return next;
    });
  }

  /**
   * `opponentKey` should only be passed for a battle type that can actually
   * end a run (gym/eliteFour/champion) — a rival loss never ends the run
   * (see roulette-container.component.ts's rivalBattleResult), so it's never
   * a "nemesis" and callers should omit the key for it.
   */
  recordBattleLoss(battleType: BattleType, opponentKey?: string): void {
    this.currentRunBattleLossCount++;
    const generationId = this.currentRunGenerationId;
    this.update(stats => ({
      ...stats,
      battleTypeLosses: { ...stats.battleTypeLosses, [battleType]: stats.battleTypeLosses[battleType] + 1 },
      nemesisDefeats: opponentKey ? incrementRecord(stats.nemesisDefeats, opponentKey) : stats.nemesisDefeats,
      nemesisDefeatsByGen: opponentKey && generationId !== null
        ? incrementNestedRecord(stats.nemesisDefeatsByGen, generationId, opponentKey)
        : stats.nemesisDefeatsByGen,
    }));
  }

  /**
   * Call once per run, at the terminal transition (game-over or
   * game-finish), before the run blob is cleared. Folds the run's species
   * ownership, team type distribution, and (on victory) per-species victory
   * counts and record-book fields.
   */
  recordRunEnd(victory: boolean, roundsReached: number): void {
    const team = this.trainerService.getTeam();
    const speciesSeen = this.currentRunSpeciesSeen;
    const startedAt = this.currentRunStartedAt;
    const generationId = this.currentRunGenerationId;
    const starterPokemonId = this.currentRunStarterPokemonId;
    const battleLossCount = this.currentRunBattleLossCount;
    const endedAt = this.now();

    this.update(stats => {
      const next: PlayerStats = {
        ...stats,
        longestRunRounds: Math.max(stats.longestRunRounds, roundsReached),
        speciesOwnedCounts: incrementRecordForEach(stats.speciesOwnedCounts, speciesSeen),
        typeCounts: addTeamTypeCounts(stats.typeCounts, team),
        lastPlayedAt: endedAt,
      };

      if (startedAt !== null && generationId !== null && starterPokemonId !== null) {
        const entry: RunLogEntry = { victory, generationId, roundsReached, starterPokemonId, startedAt, endedAt };
        next.runHistory = [...stats.runHistory, entry].slice(-RUN_HISTORY_CAP);
      }

      if (generationId !== null) {
        next.speciesOwnedCountsByGen = incrementNestedRecordForEach(stats.speciesOwnedCountsByGen, generationId, speciesSeen);
        next.typeCountsByGen = {
          ...stats.typeCountsByGen,
          [generationId]: addTeamTypeCounts(stats.typeCountsByGen[generationId] ?? {}, team),
        };
      }

      if (victory) {
        next.victories = stats.victories + 1;
        next.currentStreak = stats.currentStreak > 0 ? stats.currentStreak + 1 : 1;
        next.bestWinStreak = Math.max(stats.bestWinStreak, next.currentStreak);
        next.fastestVictoryRounds = stats.fastestVictoryRounds === null
          ? roundsReached
          : Math.min(stats.fastestVictoryRounds, roundsReached);
        next.speciesVictoryCounts = incrementRecordForEach(stats.speciesVictoryCounts, speciesSeen);
        if (battleLossCount === 0) {
          next.perfectRuns = stats.perfectRuns + 1;
        }
      } else {
        next.defeats = stats.defeats + 1;
        next.currentStreak = stats.currentStreak < 0 ? stats.currentStreak - 1 : -1;
      }

      return next;
    });

    this.currentRunSpeciesSeen = new Set();
    this.currentRunStartedAt = null;
    this.currentRunGenerationId = null;
    this.currentRunStarterPokemonId = null;
    this.currentRunBattleLossCount = 0;
  }

  protected loadStats(): PlayerStats {
    const storageItem = localStorage.getItem(this.STATS_STORAGE_KEY);
    if (!storageItem) {
      return createDefaultPlayerStats();
    }

    try {
      return normalizePlayerStats(JSON.parse(storageItem));
    } catch (error) {
      console.error('Invalid stats localStorage item:', storageItem, 'discarding saved stats');
      return createDefaultPlayerStats();
    }
  }

  protected persist(stats: PlayerStats): void {
    try {
      localStorage.setItem(this.STATS_STORAGE_KEY, JSON.stringify(stats));
    } catch (error) {
      console.error('Failed to save stats to localStorage:', error);
    }
    this.statsSubject.next(stats);
  }

  protected update(mutate: (stats: PlayerStats) => PlayerStats): void {
    this.persist(this.applyAchievementUnlocks(mutate(this.current)));
  }

  /**
   * Runs every ACHIEVEMENTS predicate against the freshly-mutated stats and
   * marks/emits any not-yet-unlocked achievement whose condition now holds.
   * Cheap (achievement count is small) so it's fine to run on every mutation
   * rather than only at run boundaries — some achievements (e.g. first-shiny)
   * unlock mid-run.
   */
  private applyAchievementUnlocks(stats: PlayerStats): PlayerStats {
    let unlockedIds = stats.unlockedAchievementIds;
    let changed = false;

    for (const achievement of ACHIEVEMENTS) {
      if (!unlockedIds[achievement.id] && achievement.isUnlocked(stats)) {
        if (!changed) {
          unlockedIds = { ...unlockedIds };
          changed = true;
        }
        unlockedIds[achievement.id] = true;
        this.achievementUnlockedSubject.next(achievement);
      }
    }

    return changed ? { ...stats, unlockedAchievementIds: unlockedIds } : stats;
  }

  /** Overridable seam for deterministic timing in tests. */
  protected now(): number {
    return Date.now();
  }
}

function incrementRecord<K extends string | number>(record: Record<K, number>, key: K): Record<K, number> {
  return { ...record, [key]: (record[key] ?? 0) + 1 };
}

function incrementRecordForEach(record: Record<number, number>, keys: Iterable<number>): Record<number, number> {
  const next = { ...record };
  for (const key of keys) {
    next[key] = (next[key] ?? 0) + 1;
  }
  return next;
}

/** Two-level version of incrementRecord() for the per-generation breakdown (plan V3 §4). */
function incrementNestedRecord<K extends string | number>(
  nested: Record<number, Record<K, number>>,
  generationId: number,
  key: K
): Record<number, Record<K, number>> {
  return { ...nested, [generationId]: incrementRecord(nested[generationId] ?? ({} as Record<K, number>), key) };
}

/** Two-level version of incrementRecordForEach() for the per-generation breakdown (plan V3 §4). */
function incrementNestedRecordForEach(
  nested: Record<number, Record<number, number>>,
  generationId: number,
  keys: Iterable<number>
): Record<number, Record<number, number>> {
  return { ...nested, [generationId]: incrementRecordForEach(nested[generationId] ?? {}, keys) };
}

/** Shared by the lifetime typeCounts and the per-generation typeCountsByGen breakdown. */
function addTeamTypeCounts(base: Partial<Record<PokemonType, number>>, team: PokemonItem[]): Partial<Record<PokemonType, number>> {
  const next = { ...base };
  for (const pokemon of team) {
    if (pokemon.type1) {
      next[pokemon.type1] = (next[pokemon.type1] ?? 0) + 1;
    }
    if (pokemon.type2) {
      next[pokemon.type2] = (next[pokemon.type2] ?? 0) + 1;
    }
  }
  return next;
}

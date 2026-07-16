import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { BattleTypeCounts, createDefaultPlayerStats, normalizePlayerStats, PlayerStats } from '../../interfaces/player-stats';
import { TrainerService } from '../trainer-service/trainer.service';
import { computeStatsSummary, PlayerStatsSummary } from './stats-selectors';

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

  reset(): void {
    this.currentRunSpeciesSeen = new Set();
    this.persist(createDefaultPlayerStats());
  }

  /** Call once, at the moment a new run's starter is captured. */
  recordRunStart(generationId: number, starterPokemonId: number): void {
    this.currentRunSpeciesSeen = new Set();
    this.update(stats => ({
      ...stats,
      runsPlayed: stats.runsPlayed + 1,
      generationPlayCounts: incrementRecord(stats.generationPlayCounts, generationId),
      starterCounts: incrementRecord(stats.starterCounts, starterPokemonId),
    }));
  }

  recordCapture(): void {
    this.update(stats => ({ ...stats, pokemonCaught: stats.pokemonCaught + 1 }));
  }

  recordShiny(): void {
    this.update(stats => ({ ...stats, shiniesCaught: stats.shiniesCaught + 1 }));
  }

  recordBattleWin(battleType: BattleType): void {
    this.update(stats => {
      const next: PlayerStats = {
        ...stats,
        battleTypeWins: { ...stats.battleTypeWins, [battleType]: stats.battleTypeWins[battleType] + 1 },
      };
      const counterField = BATTLES_WON_COUNTER[battleType];
      if (counterField) {
        (next[counterField] as number) = (stats[counterField] as number) + 1;
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
    this.update(stats => ({
      ...stats,
      battleTypeLosses: { ...stats.battleTypeLosses, [battleType]: stats.battleTypeLosses[battleType] + 1 },
      nemesisDefeats: opponentKey ? incrementRecord(stats.nemesisDefeats, opponentKey) : stats.nemesisDefeats,
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

    this.update(stats => {
      const next: PlayerStats = {
        ...stats,
        longestRunRounds: Math.max(stats.longestRunRounds, roundsReached),
        speciesOwnedCounts: incrementRecordForEach(stats.speciesOwnedCounts, speciesSeen),
        typeCounts: { ...stats.typeCounts },
      };

      for (const pokemon of team) {
        if (pokemon.type1) {
          next.typeCounts[pokemon.type1] = (next.typeCounts[pokemon.type1] ?? 0) + 1;
        }
        if (pokemon.type2) {
          next.typeCounts[pokemon.type2] = (next.typeCounts[pokemon.type2] ?? 0) + 1;
        }
      }

      if (victory) {
        next.victories = stats.victories + 1;
        next.currentStreak = stats.currentStreak > 0 ? stats.currentStreak + 1 : 1;
        next.bestWinStreak = Math.max(stats.bestWinStreak, next.currentStreak);
        next.fastestVictoryRounds = stats.fastestVictoryRounds === null
          ? roundsReached
          : Math.min(stats.fastestVictoryRounds, roundsReached);
        next.speciesVictoryCounts = incrementRecordForEach(stats.speciesVictoryCounts, speciesSeen);
      } else {
        next.defeats = stats.defeats + 1;
        next.currentStreak = stats.currentStreak < 0 ? stats.currentStreak - 1 : -1;
      }

      return next;
    });

    this.currentRunSpeciesSeen = new Set();
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
    this.persist(mutate(this.current));
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

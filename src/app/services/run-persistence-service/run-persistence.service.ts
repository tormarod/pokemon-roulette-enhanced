import { Injectable } from '@angular/core';
import { combineLatest } from 'rxjs';
import { GameState } from '../game-state-service/game-state';
import { GameStateService } from '../game-state-service/game-state.service';
import { PendingTypeBiases, TrainerService, TypeBiasEntry } from '../trainer-service/trainer.service';
import { GenerationService } from '../generation-service/generation.service';
import { BattlePrepService, PendingBattlePrep } from '../battle-prep-service/battle-prep.service';
import { DangerMeterService } from '../danger-meter-service/danger-meter.service';
import { AdventureDrawService, PendingAdventureDraw } from '../adventure-draw-service/adventure-draw.service';
import { BattleDebuffService } from '../battle-debuff-service/battle-debuff.service';
import { MarkedTargetService } from '../marked-target-service/marked-target.service';
import { CatchRiskService } from '../catch-risk-service/catch-risk.service';
import { ScoutingReportService } from '../scouting-report-service/scouting-report.service';
import { PcLockService } from '../pc-lock-service/pc-lock.service';
import { MarketStockService, MarketStockState } from '../market-stock-service/market-stock.service';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { ItemItem } from '../../interfaces/item-item';
import { Badge } from '../../interfaces/badge';
import { MegaStoneItemName } from '../items-service/item-names';
import { PokemonType } from '../../interfaces/pokemon-type';

/** Bumped when a save's shape changes incompatibly. */
const RUN_FORMAT = 4;

export interface SavedRun {
  state: GameState;
  stateStack: GameState[];
  currentRound: number;
  trainerTeam: PokemonItem[];
  storedPokemon: PokemonItem[];
  trainerItems: ItemItem[];
  trainerBadges: Badge[];
  gender: string;
  generationId: number;
  pendingTypeBiases: PendingTypeBiases;
  runFormat?: number;
  pendingBattlePrep: PendingBattlePrep | null;
  dangerPercent: number;
  consecutiveThreats: number;
  guaranteedRewardSteps: number;
  shieldedSteps: number;
  pendingAdventure: PendingAdventureDraw | null;
  pendingBattleDebuff: number;
  markedTeamIndex: number | null;
  pendingCatchEscapeChance: number;
  coins: number;
  megaBattleBaseId: number | null;
  megaBattleStoneName: MegaStoneItemName | null;
  megaBattleOriginalPokemon: PokemonItem | null;
  scoutingType: PokemonType | null;
  pcLocked: boolean;
  marketStock: MarketStockState | null;
}

/** A run reaching either of these states is over — nothing left to resume. */
const TERMINAL_STATES = new Set<GameState>(['game-over', 'game-finish']);

@Injectable({
  providedIn: 'root'
})
export class RunPersistenceService {
  private readonly RUN_STORAGE_KEY = 'pokemon-roulette-run';

  constructor(
    private gameStateService: GameStateService,
    private trainerService: TrainerService,
    private generationService: GenerationService,
    private battlePrepService: BattlePrepService,
    private dangerMeterService: DangerMeterService,
    private adventureDrawService: AdventureDrawService,
    private battleDebuffService: BattleDebuffService,
    private markedTargetService: MarkedTargetService,
    private catchRiskService: CatchRiskService,
    private scoutingReportService: ScoutingReportService,
    private pcLockService: PcLockService,
    private marketStockService: MarketStockService,
  ) {
    // Restore BEFORE wiring the auto-save subscription below — otherwise that
    // subscription's own first (synchronous) emission of fresh/default state
    // would immediately overwrite the very save we're about to read.
    const savedRun = this.loadRun();
    if (savedRun) {
      this.restoreRun(savedRun);
    } else {
      // No valid save (first-ever visit, or one just discarded as stale/invalid):
      // route through the same single source of truth as an explicit Restart so
      // starting state (e.g. the starter X Attack, only granted by resetItems()
      // inside startFreshRun()) isn't silently skipped in favor of raw field
      // defaults that can drift out of sync with it.
      this.startFreshRun();
    }

    combineLatest([
      this.gameStateService.currentState,
      this.gameStateService.currentRoundObserver,
      this.trainerService.getTeamObservable(),
      this.trainerService.getItemsObservable(),
      this.trainerService.getBadgesObservable(),
      this.trainerService.getTrainer(),
      this.generationService.getGeneration(),
      this.trainerService.getPendingTypeBiasesObservable(),
      this.battlePrepService.getPendingPrepObservable(),
      this.dangerMeterService.getStateObservable(),
      this.adventureDrawService.getPendingDrawObservable(),
      this.battleDebuffService.getPendingDebuffObservable(),
      this.markedTargetService.getPendingMarkObservable(),
      this.catchRiskService.getPendingEscapeChanceObservable(),
      this.trainerService.getCoinsObservable(),
      this.scoutingReportService.getPendingTypeObservable(),
      this.pcLockService.getLockedObservable(),
      this.marketStockService.getStateObservable(),
    ]).subscribe(([state, currentRound, trainerTeam, trainerItems, trainerBadges, , generation, pendingTypeBiases, pendingBattlePrep, dangerMeterState, pendingAdventure, pendingBattleDebuff, markedTeamIndex, pendingCatchEscapeChance, coins, scoutingType, pcLocked, marketStock]) => {
      if (TERMINAL_STATES.has(state)) {
        this.clearRun();
        return;
      }

      this.persistRun({
        state,
        stateStack: this.gameStateService.getStateStack(),
        currentRound,
        trainerTeam,
        storedPokemon: this.trainerService.getStored(),
        trainerItems,
        trainerBadges,
        gender: this.trainerService.gender,
        generationId: generation.id,
        pendingTypeBiases,
        runFormat: RUN_FORMAT,
        pendingBattlePrep,
        dangerPercent: dangerMeterState.dangerPercent,
        consecutiveThreats: dangerMeterState.consecutiveThreats,
        guaranteedRewardSteps: dangerMeterState.guaranteedRewardSteps,
        shieldedSteps: dangerMeterState.shieldedSteps,
        pendingAdventure,
        pendingBattleDebuff,
        markedTeamIndex,
        pendingCatchEscapeChance,
        coins,
        // Read synchronously — applying/reverting a mega calls trainerTeamObservable.next,
        // so this combineLatest already re-fires whenever the mega state changes.
        megaBattleBaseId: this.trainerService.getMegaBattleBaseId(),
        megaBattleStoneName: this.trainerService.getMegaBattleStoneName(),
        megaBattleOriginalPokemon: this.trainerService.getMegaBattleOriginalPokemon(),
        scoutingType,
        pcLocked,
        marketStock,
      });
    });
  }

  loadRun(): SavedRun | null {
    const storageItem = localStorage.getItem(this.RUN_STORAGE_KEY);
    if (!storageItem) {
      return null;
    }

    try {
      const parsed = JSON.parse(storageItem);
      if (this.isPreV4Run(parsed)) {
        this.clearRun();
        return null;
      }
      if (this.isValidSavedRun(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.error('Invalid run localStorage item:', storageItem, 'discarding saved run');
    }

    return null;
  }

  clearRun(): void {
    localStorage.removeItem(this.RUN_STORAGE_KEY);
  }

  /**
   * Single source of truth for "start a brand-new run" — both the sidebar Restart
   * button (MainGameComponent) and the Settings page's Restart button used to each
   * duplicate a partial version of this, and both left every per-run ancillary
   * service (battle prep, danger meter, adventure draw, battle debuff, marked
   * target, catch risk) holding stale state from the previous run. A stale
   * committed battlePrepService entry in particular could make a fresh run's
   * first battle skip the prep panel entirely (its battleKey still matched),
   * which only cleared itself once that stale battle resolved.
   */
  startFreshRun(): void {
    this.trainerService.resetTrainer();
    this.trainerService.resetTeam();
    this.trainerService.resetItems();
    this.trainerService.resetBadges();
    this.trainerService.clearPendingTypeBiases();
    this.gameStateService.resetGameState();
    this.battlePrepService.clearPrep();
    this.dangerMeterService.resetForNewRun();
    this.adventureDrawService.clearDraw();
    this.battleDebuffService.clearDebuff();
    this.markedTargetService.clearMark();
    this.catchRiskService.clearEscapeChance();
    this.scoutingReportService.clearType();
    this.pcLockService.clearLock();
    this.marketStockService.resetForNewRun();
    this.trainerService.resetCoins();
    this.trainerService.resetMegaBattleState();
    this.clearRun();
  }

  private restoreRun(run: SavedRun): void {
    this.generationService.setGenerationById(run.generationId);
    this.trainerService.commitTeamAndStorage(run.trainerTeam, run.storedPokemon);
    // Must precede restoreState below: restoring the state re-emits currentState,
    // which drives syncBattleForms → revertMegaForms. Without the original in
    // place first, a reload while mega'd couldn't revert and the mega stuck.
    this.trainerService.restoreMegaBattleState(
      run.megaBattleBaseId ?? null,
      run.megaBattleStoneName ?? null,
      run.megaBattleOriginalPokemon ?? null
    );
    this.trainerService.restoreItems(run.trainerItems);
    this.trainerService.restoreBadges(run.trainerBadges);
    this.trainerService.setTrainer(run.generationId, run.gender);
    // Older saves may have no pendingTypeBiases field, or the pre-stacking
    // single-entry shape ({ toward: {type,mode}|null, away: ... }) instead of
    // today's array shape — normalize both into the current array format.
    this.trainerService.restorePendingTypeBiases(this.normalizePendingTypeBiases(run.pendingTypeBiases));
    this.gameStateService.restoreState(run.state, run.stateStack, run.currentRound);
    this.battlePrepService.restorePrep(run.pendingBattlePrep ?? null);
    this.dangerMeterService.restore(run.dangerPercent ?? 10, run.consecutiveThreats ?? 0, run.guaranteedRewardSteps ?? 0, run.shieldedSteps ?? 0);
    this.adventureDrawService.restoreDraw(run.pendingAdventure ?? null);
    this.battleDebuffService.restoreDebuff(run.pendingBattleDebuff ?? 0);
    this.markedTargetService.restoreMark(run.markedTeamIndex ?? null);
    this.catchRiskService.restoreEscapeChance(run.pendingCatchEscapeChance ?? 0);
    this.trainerService.restoreCoins(run.coins ?? 0);
    this.scoutingReportService.restoreType(run.scoutingType ?? null);
    this.pcLockService.setLock(run.pcLocked ?? false);
    this.marketStockService.restore(run.marketStock ?? null);
  }

  private normalizePendingTypeBiases(value: unknown): PendingTypeBiases {
    const record = (value ?? {}) as { toward?: unknown; honey?: unknown };
    return {
      toward: this.normalizeBiasDirection(record.toward),
      honey: Array.isArray(record.honey) ? record.honey.filter(Array.isArray) : []
    };
  }

  private normalizeBiasDirection(value: unknown): TypeBiasEntry[] {
    if (Array.isArray(value)) {
      return value as TypeBiasEntry[];
    }
    if (value && typeof value === 'object') {
      return [value as TypeBiasEntry];
    }
    return [];
  }

  private persistRun(run: SavedRun): void {
    try {
      localStorage.setItem(this.RUN_STORAGE_KEY, JSON.stringify(run));
    } catch (error) {
      console.error('Failed to save run to localStorage:', error);
    }
  }

  /**
   * 4.0.0 discards every save written before it. Two reasons, both hard:
   * Classic-mode runs describe a ruleset that no longer exists (no coin
   * balance, no danger cadence, a passively-applied X Attack), and pre-4.0
   * saves of *any* mode can hold a pending adventure draw referencing the old
   * `buyPotions` candidate id, which resolveCandidates() would silently drop.
   * Rather than carry a per-field migration for a game with a handful of
   * players, the whole pre-4.0 shape is dropped: a save is kept only if it
   * carries `runFormat`, which only 4.0+ writes.
   */
  private isPreV4Run(value: unknown): boolean {
    const run = value as { runFormat?: unknown };
    return !(typeof run.runFormat === 'number' && run.runFormat >= RUN_FORMAT);
  }

  private isValidSavedRun(value: unknown): value is SavedRun {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const run = value as Partial<SavedRun>;
    return (
      typeof run.state === 'string' &&
      Array.isArray(run.stateStack) &&
      typeof run.currentRound === 'number' &&
      Array.isArray(run.trainerTeam) &&
      Array.isArray(run.storedPokemon) &&
      Array.isArray(run.trainerItems) &&
      Array.isArray(run.trainerBadges) &&
      typeof run.gender === 'string' &&
      typeof run.generationId === 'number' &&
      (run.pendingTypeBiases === undefined || typeof run.pendingTypeBiases === 'object') &&
      (run.pendingBattlePrep === undefined || run.pendingBattlePrep === null || typeof run.pendingBattlePrep === 'object') &&
      (run.dangerPercent === undefined || typeof run.dangerPercent === 'number') &&
      (run.consecutiveThreats === undefined || typeof run.consecutiveThreats === 'number') &&
      (run.guaranteedRewardSteps === undefined || typeof run.guaranteedRewardSteps === 'number') &&
      (run.shieldedSteps === undefined || typeof run.shieldedSteps === 'number') &&
      (run.pendingAdventure === undefined || run.pendingAdventure === null || typeof run.pendingAdventure === 'object') &&
      (run.pendingBattleDebuff === undefined || typeof run.pendingBattleDebuff === 'number') &&
      (run.markedTeamIndex === undefined || run.markedTeamIndex === null || typeof run.markedTeamIndex === 'number') &&
      (run.pendingCatchEscapeChance === undefined || typeof run.pendingCatchEscapeChance === 'number') &&
      (run.coins === undefined || typeof run.coins === 'number') &&
      (run.megaBattleBaseId === undefined || run.megaBattleBaseId === null || typeof run.megaBattleBaseId === 'number') &&
      (run.megaBattleStoneName === undefined || run.megaBattleStoneName === null || typeof run.megaBattleStoneName === 'string') &&
      (run.megaBattleOriginalPokemon === undefined || run.megaBattleOriginalPokemon === null || typeof run.megaBattleOriginalPokemon === 'object') &&
      (run.scoutingType === undefined || run.scoutingType === null || typeof run.scoutingType === 'string') &&
      (run.pcLocked === undefined || typeof run.pcLocked === 'boolean') &&
      (run.marketStock === undefined || run.marketStock === null || typeof run.marketStock === 'object')
    );
  }
}

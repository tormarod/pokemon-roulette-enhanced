import { Injectable } from '@angular/core';
import { combineLatest } from 'rxjs';
import { GameState } from '../game-state-service/game-state';
import { GameStateService } from '../game-state-service/game-state.service';
import { PendingTypeBiases, TrainerService, TypeBiasEntry } from '../trainer-service/trainer.service';
import { GenerationService } from '../generation-service/generation.service';
import { PokemonItem } from '../../interfaces/pokemon-item';
import { ItemItem } from '../../interfaces/item-item';
import { Badge } from '../../interfaces/badge';

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
  ) {
    // Restore BEFORE wiring the auto-save subscription below — otherwise that
    // subscription's own first (synchronous) emission of fresh/default state
    // would immediately overwrite the very save we're about to read.
    const savedRun = this.loadRun();
    if (savedRun) {
      this.restoreRun(savedRun);
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
    ]).subscribe(([state, currentRound, trainerTeam, trainerItems, trainerBadges, , generation, pendingTypeBiases]) => {
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

  private restoreRun(run: SavedRun): void {
    this.generationService.setGenerationById(run.generationId);
    this.trainerService.commitTeamAndStorage(run.trainerTeam, run.storedPokemon);
    this.trainerService.restoreItems(run.trainerItems);
    this.trainerService.restoreBadges(run.trainerBadges);
    this.trainerService.setTrainer(run.generationId, run.gender);
    // Older saves may have no pendingTypeBiases field, or the pre-stacking
    // single-entry shape ({ toward: {type,mode}|null, away: ... }) instead of
    // today's array shape — normalize both into the current array format.
    this.trainerService.restorePendingTypeBiases(this.normalizePendingTypeBiases(run.pendingTypeBiases));
    this.gameStateService.restoreState(run.state, run.stateStack, run.currentRound);
  }

  private normalizePendingTypeBiases(value: unknown): PendingTypeBiases {
    const record = (value ?? {}) as { toward?: unknown; away?: unknown };
    return {
      toward: this.normalizeBiasDirection(record.toward),
      away: this.normalizeBiasDirection(record.away)
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
      (run.pendingTypeBiases === undefined || typeof run.pendingTypeBiases === 'object')
    );
  }
}

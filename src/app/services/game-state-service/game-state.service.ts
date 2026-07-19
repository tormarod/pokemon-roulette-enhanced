import { Injectable } from '@angular/core';
import { GameState } from './game-state';
import { BehaviorSubject, Observable } from 'rxjs';
import { GenerationService } from '../generation-service/generation.service';
import { SettingsService } from '../settings-service/settings.service';

const GENERATION_GAME_CONFIG: Record<number, { gymCount: number; eliteFourCount: number }> = {
  1: { gymCount: 8, eliteFourCount: 4 },
  2: { gymCount: 8, eliteFourCount: 4 },
  3: { gymCount: 8, eliteFourCount: 4 },
  4: { gymCount: 8, eliteFourCount: 4 },
  5: { gymCount: 8, eliteFourCount: 4 },
  6: { gymCount: 8, eliteFourCount: 4 },
  7: { gymCount: 8, eliteFourCount: 4 },
  8: { gymCount: 8, eliteFourCount: 4 },
  9: { gymCount: 8, eliteFourCount: 4 },
};

@Injectable({
  providedIn: 'root'
})
export class GameStateService {

  private stateStack: GameState[] = [];
  private state = new BehaviorSubject<GameState>('game-start');
  currentState = this.state.asObservable();

  private currentRound = new BehaviorSubject<number>(0);
  currentRoundObserver = this.currentRound.asObservable();

  private wheelSpinning = new BehaviorSubject<boolean>(false);
  wheelSpinningObserver = this.wheelSpinning.asObservable();

  // Seeded from the current setting so a brand-new player's very first-ever run
  // (before RunPersistenceService has any saved run to restore, and before any
  // explicit Restart re-reads the setting) already reflects it, instead of
  // silently starting in Classic mode regardless of the setting's default.
  private newExperienceMode: BehaviorSubject<boolean>;
  newExperienceModeObserver: Observable<boolean>;

  constructor(private generationService: GenerationService, private settingsService: SettingsService) {
    this.newExperienceMode = new BehaviorSubject<boolean>(this.settingsService.currentSettings.newExperienceMode);
    this.newExperienceModeObserver = this.newExperienceMode.asObservable();
    const genId = this.generationService.getCurrentGeneration().id;
    const config = GENERATION_GAME_CONFIG[genId] ?? { gymCount: 8, eliteFourCount: 4 };
    this.initializeStates(config.gymCount, config.eliteFourCount);
  }

  private initializeStates(gymCount: number = 8, eliteFourCount: number = 4): void {
    const stack: GameState[] = ['game-finish', 'champion-battle'];

    for (let i = 0; i < eliteFourCount; i++) {
      stack.push('elite-four-battle');
    }

    stack.push('elite-four-preparation');

    for (let i = 0; i < gymCount; i++) {
      stack.push('gym-battle');
      if (i < gymCount - 1) {
        stack.push('adventure-continues');
      }
    }

    stack.push('start-adventure');
    stack.push('starter-pokemon');
    stack.push('character-select');

    this.stateStack = stack;
  }

  setNextState(newState: GameState): void {
    this.stateStack.push(newState);
  }

  getStateStack(): GameState[] {
    return [...this.stateStack];
  }

  /** Directly overwrites state/stack/round from a saved run, bypassing the normal push/pop flow. */
  restoreState(state: GameState, stateStack: GameState[], currentRound: number): void {
    this.stateStack = [...stateStack];
    this.currentRound.next(currentRound);
    this.state.next(state);
  }

  finishCurrentState(): GameState {
    if (this.stateStack.length > 0) {
      const poppedState = this.stateStack.pop();
      if (poppedState) {
        this.state.next(poppedState);
        return poppedState;
      }
    }
    return 'game-over';
  }

  /** Synchronous read for non-reactive call sites (e.g. DangerMeterService.rollStep). */
  get currentRoundValue(): number {
    return this.currentRound.value;
  }

  advanceRound(): void {
    this.currentRound.next(this.currentRound.value + 1);
  }

  retreatRound(): void {
    this.currentRound.next(this.currentRound.value - 1);
  }

  repeatCurrentState(): void {
    this.stateStack.push(this.state.value);
  }

  setWheelSpinning(state: boolean): void {
    this.wheelSpinning.next(state);
  }

  /** Synchronous read for non-reactive call sites (e.g. calcVictoryOdds()). */
  get isNewExperienceMode(): boolean {
    return this.newExperienceMode.value;
  }

  /** Restores the snapshot taken at run start, without touching the stack/round. */
  restoreNewExperienceMode(value: boolean): void {
    this.newExperienceMode.next(value);
  }

  resetGameState(newExperienceMode: boolean = false): void {
    const genId = this.generationService.getCurrentGeneration().id;
    const config = GENERATION_GAME_CONFIG[genId] ?? { gymCount: 8, eliteFourCount: 4 };
    this.initializeStates(config.gymCount, config.eliteFourCount);
    this.setNextState('game-start');
    this.finishCurrentState();
    this.currentRound.next(0);
    this.newExperienceMode.next(newExperienceMode);
  }
}

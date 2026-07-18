import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { RunPersistenceService, SavedRun } from './run-persistence.service';
import { TrainerService } from '../trainer-service/trainer.service';
import { GameStateService } from '../game-state-service/game-state.service';
import { GenerationService } from '../generation-service/generation.service';
import { BattlePrepService } from '../battle-prep-service/battle-prep.service';
import { DangerMeterService } from '../danger-meter-service/danger-meter.service';
import { AdventureDrawService } from '../adventure-draw-service/adventure-draw.service';
import { BattleDebuffService } from '../battle-debuff-service/battle-debuff.service';
import { PokemonItem } from '../../interfaces/pokemon-item';

describe('RunPersistenceService', () => {
  const RUN_KEY = 'pokemon-roulette-run';

  let service: RunPersistenceService;
  let trainerService: TrainerService;
  let gameStateService: GameStateService;
  let generationService: GenerationService;

  const makeTestPokemon = (overrides: Partial<PokemonItem> = {}): PokemonItem => ({
    pokemonId: 1,
    text: 'pokemon.bulbasaur',
    fillStyle: 'green',
    sprite: { front_default: 'test.png', front_shiny: 'test-shiny.png' },
    shiny: false,
    power: 2,
    weight: 1,
    ...overrides,
  } as PokemonItem);

  const configureFreshTestBed = () => {
    const httpSpyObj = jasmine.createSpyObj('HttpClient', ['get']);
    httpSpyObj.get.and.returnValue(of({ sprites: { other: { 'official-artwork': { front_default: 'url', front_shiny: 'url' } } } }));

    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: httpSpyObj }],
    });
  };

  beforeEach(() => {
    localStorage.clear();
    configureFreshTestBed();

    service = TestBed.inject(RunPersistenceService);
    trainerService = TestBed.inject(TrainerService);
    gameStateService = TestBed.inject(GameStateService);
    generationService = TestBed.inject(GenerationService);
    gameStateService.resetGameState();
    trainerService.resetTeam();
    trainerService.resetItems();
    trainerService.resetBadges();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ── Auto-save on committed mutations ────────────────────────────────────

  it('should save a run snapshot to localStorage when the team changes', () => {
    trainerService.addToTeam(makeTestPokemon());

    const stored = JSON.parse(localStorage.getItem(RUN_KEY)!) as SavedRun;
    expect(stored.trainerTeam.length).toBe(1);
    expect(stored.trainerTeam[0].pokemonId).toBe(1);
  });

  it('should save a run snapshot to localStorage when items change', () => {
    trainerService.addToItems({ name: 'super-potion', text: '', fillStyle: '', weight: 1, description: '', sprite: 'x' });

    const stored = JSON.parse(localStorage.getItem(RUN_KEY)!) as SavedRun;
    expect(stored.trainerItems.some(i => i.name === 'super-potion')).toBeTrue();
  });

  it('should save the newExperienceMode snapshot taken at run start', () => {
    gameStateService.resetGameState(true);
    trainerService.addToTeam(makeTestPokemon());

    const stored = JSON.parse(localStorage.getItem(RUN_KEY)!) as SavedRun;
    expect(stored.newExperienceMode).toBeTrue();
  });

  it('should restore newExperienceMode from a saved run on construction', () => {
    const savedRun: SavedRun = {
      state: 'gym-battle',
      stateStack: ['game-finish', 'champion-battle'],
      currentRound: 1,
      trainerTeam: [],
      storedPokemon: [],
      trainerItems: [],
      trainerBadges: [],
      gender: 'male',
      generationId: 1,
      pendingTypeBiases: { toward: [], away: [] },
      newExperienceMode: true,
      pendingBattlePrep: null,
      dangerPercent: 5,
      consecutiveThreats: 0,
      pendingAdventure: null,
      pendingBattleDebuff: 0,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(savedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredGameStateService = TestBed.inject(GameStateService);
    expect(restoredGameStateService.isNewExperienceMode).toBeTrue();
  });

  it('should default newExperienceMode to false when restoring an older save without the field', () => {
    const legacySavedRun = {
      state: 'gym-battle',
      stateStack: ['game-finish', 'champion-battle'],
      currentRound: 1,
      trainerTeam: [],
      storedPokemon: [],
      trainerItems: [],
      trainerBadges: [],
      gender: 'male',
      generationId: 1,
      pendingTypeBiases: { toward: [], away: [] },
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(legacySavedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredGameStateService = TestBed.inject(GameStateService);
    expect(restoredGameStateService.isNewExperienceMode).toBeFalse();
  });

  it('should save a committed battle prep to localStorage', () => {
    const battlePrepService = TestBed.inject(BattlePrepService);
    battlePrepService.commitPrep({ battleKey: 'gym-battle', leadIndex: 0, xAttackUsed: false });
    trainerService.addToTeam(makeTestPokemon());

    const stored = JSON.parse(localStorage.getItem(RUN_KEY)!) as SavedRun;
    expect(stored.pendingBattlePrep).toEqual({ battleKey: 'gym-battle', leadIndex: 0, xAttackUsed: false });
  });

  it('should restore a pending battle prep from a saved run on construction', () => {
    const savedRun: SavedRun = {
      state: 'gym-battle',
      stateStack: ['game-finish', 'champion-battle'],
      currentRound: 1,
      trainerTeam: [],
      storedPokemon: [],
      trainerItems: [],
      trainerBadges: [],
      gender: 'male',
      generationId: 1,
      pendingTypeBiases: { toward: [], away: [] },
      newExperienceMode: true,
      pendingBattlePrep: { battleKey: 'gym-battle', leadIndex: 1, xAttackUsed: true },
      dangerPercent: 5,
      consecutiveThreats: 0,
      pendingAdventure: null,
      pendingBattleDebuff: 0,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(savedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredBattlePrepService = TestBed.inject(BattlePrepService);
    expect(restoredBattlePrepService.getPendingPrep()).toEqual({
      battleKey: 'gym-battle', leadIndex: 1, xAttackUsed: true
    });
  });

  it('should default pendingBattlePrep to null when restoring an older save without the field', () => {
    const legacySavedRun = {
      state: 'gym-battle',
      stateStack: ['game-finish', 'champion-battle'],
      currentRound: 1,
      trainerTeam: [],
      storedPokemon: [],
      trainerItems: [],
      trainerBadges: [],
      gender: 'male',
      generationId: 1,
      pendingTypeBiases: { toward: [], away: [] },
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(legacySavedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredBattlePrepService = TestBed.inject(BattlePrepService);
    expect(restoredBattlePrepService.getPendingPrep()).toBeNull();
  });

  it('should save the danger meter state to localStorage when it changes', () => {
    const dangerMeterService = TestBed.inject(DangerMeterService);
    dangerMeterService.restore(45, 2);
    trainerService.addToTeam(makeTestPokemon());

    const stored = JSON.parse(localStorage.getItem(RUN_KEY)!) as SavedRun;
    expect(stored.dangerPercent).toBe(45);
    expect(stored.consecutiveThreats).toBe(2);
  });

  it('should restore the danger meter state from a saved run on construction', () => {
    const savedRun: SavedRun = {
      state: 'gym-battle',
      stateStack: ['game-finish', 'champion-battle'],
      currentRound: 1,
      trainerTeam: [],
      storedPokemon: [],
      trainerItems: [],
      trainerBadges: [],
      gender: 'male',
      generationId: 1,
      pendingTypeBiases: { toward: [], away: [] },
      newExperienceMode: true,
      pendingBattlePrep: null,
      dangerPercent: 30,
      consecutiveThreats: 1,
      pendingAdventure: null,
      pendingBattleDebuff: 0,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(savedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredDangerMeterService = TestBed.inject(DangerMeterService);
    expect(restoredDangerMeterService.currentDangerPercent).toBe(30);
    expect(restoredDangerMeterService.currentConsecutiveThreats).toBe(1);
  });

  it('should default dangerPercent/consecutiveThreats when restoring an older save without those fields', () => {
    const legacySavedRun = {
      state: 'gym-battle',
      stateStack: ['game-finish', 'champion-battle'],
      currentRound: 1,
      trainerTeam: [],
      storedPokemon: [],
      trainerItems: [],
      trainerBadges: [],
      gender: 'male',
      generationId: 1,
      pendingTypeBiases: { toward: [], away: [] },
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(legacySavedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredDangerMeterService = TestBed.inject(DangerMeterService);
    expect(restoredDangerMeterService.currentDangerPercent).toBe(5);
    expect(restoredDangerMeterService.currentConsecutiveThreats).toBe(0);
  });

  it('should save a committed adventure draw to localStorage', () => {
    const adventureDrawService = TestBed.inject(AdventureDrawService);
    adventureDrawService.commitDraw('reward', ['catchPokemon', 'findItem', 'battleRival']);
    trainerService.addToTeam(makeTestPokemon());

    const stored = JSON.parse(localStorage.getItem(RUN_KEY)!) as SavedRun;
    expect(stored.pendingAdventure).toEqual({
      stepType: 'reward', candidates: ['catchPokemon', 'findItem', 'battleRival'], picked: null
    });
  });

  it('should restore a pending adventure draw from a saved run on construction', () => {
    const savedRun: SavedRun = {
      state: 'adventure-continues',
      stateStack: ['game-finish', 'champion-battle'],
      currentRound: 1,
      trainerTeam: [],
      storedPokemon: [],
      trainerItems: [],
      trainerBadges: [],
      gender: 'male',
      generationId: 1,
      pendingTypeBiases: { toward: [], away: [] },
      newExperienceMode: true,
      pendingBattlePrep: null,
      dangerPercent: 5,
      consecutiveThreats: 0,
      pendingAdventure: { stepType: 'reward', candidates: ['catchPokemon', 'findItem', 'battleRival'], picked: 1 },
      pendingBattleDebuff: 0,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(savedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredAdventureDrawService = TestBed.inject(AdventureDrawService);
    expect(restoredAdventureDrawService.getPendingDraw()).toEqual({
      stepType: 'reward', candidates: ['catchPokemon', 'findItem', 'battleRival'], picked: 1
    });
  });

  it('should default pendingAdventure to null when restoring an older save without the field', () => {
    const legacySavedRun = {
      state: 'adventure-continues',
      stateStack: ['game-finish', 'champion-battle'],
      currentRound: 1,
      trainerTeam: [],
      storedPokemon: [],
      trainerItems: [],
      trainerBadges: [],
      gender: 'male',
      generationId: 1,
      pendingTypeBiases: { toward: [], away: [] },
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(legacySavedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredAdventureDrawService = TestBed.inject(AdventureDrawService);
    expect(restoredAdventureDrawService.getPendingDraw()).toBeNull();
  });

  it('should save the pending battle debuff to localStorage when it changes', () => {
    const battleDebuffService = TestBed.inject(BattleDebuffService);
    battleDebuffService.setDebuff(2);
    trainerService.addToTeam(makeTestPokemon());

    const stored = JSON.parse(localStorage.getItem(RUN_KEY)!) as SavedRun;
    expect(stored.pendingBattleDebuff).toBe(2);
  });

  it('should restore the pending battle debuff from a saved run on construction', () => {
    const savedRun: SavedRun = {
      state: 'gym-battle',
      stateStack: ['game-finish', 'champion-battle'],
      currentRound: 1,
      trainerTeam: [],
      storedPokemon: [],
      trainerItems: [],
      trainerBadges: [],
      gender: 'male',
      generationId: 1,
      pendingTypeBiases: { toward: [], away: [] },
      newExperienceMode: true,
      pendingBattlePrep: null,
      dangerPercent: 5,
      consecutiveThreats: 0,
      pendingAdventure: null,
      pendingBattleDebuff: 2,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(savedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredBattleDebuffService = TestBed.inject(BattleDebuffService);
    expect(restoredBattleDebuffService.currentDebuff).toBe(2);
  });

  it('should default pendingBattleDebuff to 0 when restoring an older save without the field', () => {
    const legacySavedRun = {
      state: 'gym-battle',
      stateStack: ['game-finish', 'champion-battle'],
      currentRound: 1,
      trainerTeam: [],
      storedPokemon: [],
      trainerItems: [],
      trainerBadges: [],
      gender: 'male',
      generationId: 1,
      pendingTypeBiases: { toward: [], away: [] },
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(legacySavedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredBattleDebuffService = TestBed.inject(BattleDebuffService);
    expect(restoredBattleDebuffService.currentDebuff).toBe(0);
  });

  // ── Terminal states clear the save instead of persisting it ────────────

  it('should clear the saved run once state reaches game-over', () => {
    trainerService.addToTeam(makeTestPokemon());
    expect(localStorage.getItem(RUN_KEY)).not.toBeNull();

    gameStateService.setNextState('game-over');
    gameStateService.finishCurrentState();

    expect(localStorage.getItem(RUN_KEY)).toBeNull();
  });

  it('should clear the saved run once state reaches game-finish', () => {
    trainerService.addToTeam(makeTestPokemon());
    expect(localStorage.getItem(RUN_KEY)).not.toBeNull();

    gameStateService.setNextState('game-finish');
    gameStateService.finishCurrentState();

    expect(localStorage.getItem(RUN_KEY)).toBeNull();
  });

  // ── Restore on construction ─────────────────────────────────────────────

  it('should restore team/state/generation from a saved run on construction', () => {
    const savedRun: SavedRun = {
      state: 'gym-battle',
      stateStack: ['game-finish', 'champion-battle'],
      currentRound: 3,
      trainerTeam: [makeTestPokemon({ pokemonId: 4, power: 5 })],
      storedPokemon: [],
      trainerItems: [],
      trainerBadges: [],
      gender: 'female',
      generationId: 3,
      pendingTypeBiases: { toward: [{ type: 'water', mode: 'soft' }], away: [] },
      newExperienceMode: false,
      pendingBattlePrep: null,
      dangerPercent: 5,
      consecutiveThreats: 0,
      pendingAdventure: null,
      pendingBattleDebuff: 0,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(savedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredTrainerService = TestBed.inject(TrainerService);
    const restoredGameStateService = TestBed.inject(GameStateService);
    const restoredGenerationService = TestBed.inject(GenerationService);

    expect(restoredTrainerService.getTeam().length).toBe(1);
    expect(restoredTrainerService.getTeam()[0].pokemonId).toBe(4);
    expect(restoredGenerationService.getCurrentGeneration().id).toBe(3);

    let observedState: string | undefined;
    restoredGameStateService.currentState.subscribe(s => observedState = s);
    expect(observedState).toBe('gym-battle');
  });

  it('should save a run snapshot to localStorage when a pending type bias changes', () => {
    trainerService.setTowardBias({ type: 'fire', mode: 'hard' });

    const stored = JSON.parse(localStorage.getItem(RUN_KEY)!) as SavedRun;
    expect(stored.pendingTypeBiases).toEqual({ toward: [{ type: 'fire', mode: 'hard' }], away: [] });
  });

  it('should restore both pending type biases from a saved run on construction', () => {
    const savedRun: SavedRun = {
      state: 'adventure-continues',
      stateStack: ['game-finish', 'champion-battle'],
      currentRound: 1,
      trainerTeam: [],
      storedPokemon: [],
      trainerItems: [],
      trainerBadges: [],
      gender: 'male',
      generationId: 1,
      pendingTypeBiases: { toward: [{ type: 'water', mode: 'soft' }], away: [{ type: 'grass', mode: 'hard' }] },
      newExperienceMode: false,
      pendingBattlePrep: null,
      dangerPercent: 5,
      consecutiveThreats: 0,
      pendingAdventure: null,
      pendingBattleDebuff: 0,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(savedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredTrainerService = TestBed.inject(TrainerService);
    expect(restoredTrainerService.currentPendingTypeBiases.toward).toEqual([{ type: 'water', mode: 'soft' }]);
    expect(restoredTrainerService.currentPendingTypeBiases.away).toEqual([{ type: 'grass', mode: 'hard' }]);
  });

  it('should treat an older saved run with no pendingTypeBiases field as having none, without throwing', () => {
    const legacyRun = {
      state: 'adventure-continues',
      stateStack: ['game-finish', 'champion-battle'],
      currentRound: 0,
      trainerTeam: [],
      storedPokemon: [],
      trainerItems: [],
      trainerBadges: [],
      gender: 'male',
      generationId: 1,
      // pendingTypeBiases intentionally omitted, simulating a pre-existing save.
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(legacyRun));

    expect(() => {
      TestBed.resetTestingModule();
      configureFreshTestBed();
      TestBed.inject(RunPersistenceService);
    }).not.toThrow();

    const restoredTrainerService = TestBed.inject(TrainerService);
    expect(restoredTrainerService.currentPendingTypeBiases.toward).toEqual([]);
    expect(restoredTrainerService.currentPendingTypeBiases.away).toEqual([]);
  });

  it('should migrate a pre-stacking saved run with the old single-entry bias shape into the array shape', () => {
    const legacyRun = {
      state: 'adventure-continues',
      stateStack: ['game-finish', 'champion-battle'],
      currentRound: 0,
      trainerTeam: [],
      storedPokemon: [],
      trainerItems: [],
      trainerBadges: [],
      gender: 'male',
      generationId: 1,
      pendingTypeBiases: { toward: { type: 'fire', mode: 'soft' }, away: null },
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(legacyRun));

    expect(() => {
      TestBed.resetTestingModule();
      configureFreshTestBed();
      TestBed.inject(RunPersistenceService);
    }).not.toThrow();

    const restoredTrainerService = TestBed.inject(TrainerService);
    expect(restoredTrainerService.currentPendingTypeBiases.toward).toEqual([{ type: 'fire', mode: 'soft' }]);
    expect(restoredTrainerService.currentPendingTypeBiases.away).toEqual([]);
  });

  it('should discard a corrupt saved run and fall back to a fresh run without throwing', () => {
    localStorage.setItem(RUN_KEY, '{not valid json');

    expect(() => {
      TestBed.resetTestingModule();
      configureFreshTestBed();
      TestBed.inject(RunPersistenceService);
    }).not.toThrow();

    const freshTrainerService = TestBed.inject(TrainerService);
    expect(freshTrainerService.getTeam().length).toBe(0);
  });

});

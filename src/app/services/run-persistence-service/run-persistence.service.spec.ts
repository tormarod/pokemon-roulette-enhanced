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
import { MarkedTargetService } from '../marked-target-service/marked-target.service';
import { CatchRiskService } from '../catch-risk-service/catch-risk.service';
import { ScoutingReportService } from '../scouting-report-service/scouting-report.service';
import { PcLockService } from '../pc-lock-service/pc-lock.service';
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
      pendingTypeBiases: { toward: [], honey: [] },
      newExperienceMode: true,
      pendingBattlePrep: null,
      dangerPercent: 5,
      consecutiveThreats: 0,
      guaranteedRewardSteps: 0,
      shieldedSteps: 0,
      pendingAdventure: null,
      pendingBattleDebuff: 0,
      markedTeamIndex: null,
      pendingCatchEscapeChance: 0,
      coins: 0,
      megaBattleBaseId: null,
      megaBattleStoneName: null,
      megaBattleOriginalPokemon: null,
      scoutingType: null,
      pcLocked: false,
      marketStock: null,
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
      pendingTypeBiases: { toward: [], honey: [] },
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
      pendingTypeBiases: { toward: [], honey: [] },
      newExperienceMode: true,
      pendingBattlePrep: { battleKey: 'gym-battle', leadIndex: 1, xAttackUsed: true },
      dangerPercent: 5,
      consecutiveThreats: 0,
      guaranteedRewardSteps: 0,
      shieldedSteps: 0,
      pendingAdventure: null,
      pendingBattleDebuff: 0,
      markedTeamIndex: null,
      pendingCatchEscapeChance: 0,
      coins: 0,
      megaBattleBaseId: null,
      megaBattleStoneName: null,
      megaBattleOriginalPokemon: null,
      scoutingType: null,
      pcLocked: false,
      marketStock: null,
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
      pendingTypeBiases: { toward: [], honey: [] },
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
    dangerMeterService.restore(45, 2, 1, 3);
    trainerService.addToTeam(makeTestPokemon());

    const stored = JSON.parse(localStorage.getItem(RUN_KEY)!) as SavedRun;
    expect(stored.dangerPercent).toBe(45);
    expect(stored.consecutiveThreats).toBe(2);
    expect(stored.guaranteedRewardSteps).toBe(1);
    expect(stored.shieldedSteps).toBe(3);
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
      pendingTypeBiases: { toward: [], honey: [] },
      newExperienceMode: true,
      pendingBattlePrep: null,
      dangerPercent: 30,
      consecutiveThreats: 1,
      guaranteedRewardSteps: 2,
      shieldedSteps: 3,
      pendingAdventure: null,
      pendingBattleDebuff: 0,
      markedTeamIndex: null,
      pendingCatchEscapeChance: 0,
      coins: 0,
      megaBattleBaseId: null,
      megaBattleStoneName: null,
      megaBattleOriginalPokemon: null,
      scoutingType: null,
      pcLocked: false,
      marketStock: null,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(savedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredDangerMeterService = TestBed.inject(DangerMeterService);
    expect(restoredDangerMeterService.currentDangerPercent).toBe(30);
    expect(restoredDangerMeterService.currentConsecutiveThreats).toBe(1);
    expect(restoredDangerMeterService.currentGuaranteedRewardSteps).toBe(2);
    expect(restoredDangerMeterService.currentShieldedSteps).toBe(3);
  });

  it('should default shieldedSteps to 0 when restoring an older save without the field', () => {
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
      pendingTypeBiases: { toward: [], honey: [] },
      dangerPercent: 30,
      consecutiveThreats: 1,
      guaranteedRewardSteps: 2,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(legacySavedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredDangerMeterService = TestBed.inject(DangerMeterService);
    expect(restoredDangerMeterService.currentShieldedSteps).toBe(0);
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
      pendingTypeBiases: { toward: [], honey: [] },
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
      pendingTypeBiases: { toward: [], honey: [] },
      newExperienceMode: true,
      pendingBattlePrep: null,
      dangerPercent: 5,
      consecutiveThreats: 0,
      guaranteedRewardSteps: 0,
      shieldedSteps: 0,
      pendingAdventure: { stepType: 'reward', candidates: ['catchPokemon', 'findItem', 'battleRival'], picked: 1 },
      pendingBattleDebuff: 0,
      markedTeamIndex: null,
      pendingCatchEscapeChance: 0,
      coins: 0,
      megaBattleBaseId: null,
      megaBattleStoneName: null,
      megaBattleOriginalPokemon: null,
      scoutingType: null,
      pcLocked: false,
      marketStock: null,
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
      pendingTypeBiases: { toward: [], honey: [] },
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
      pendingTypeBiases: { toward: [], honey: [] },
      newExperienceMode: true,
      pendingBattlePrep: null,
      dangerPercent: 5,
      consecutiveThreats: 0,
      guaranteedRewardSteps: 0,
      shieldedSteps: 0,
      pendingAdventure: null,
      pendingBattleDebuff: 2,
      markedTeamIndex: null,
      pendingCatchEscapeChance: 0,
      coins: 0,
      megaBattleBaseId: null,
      megaBattleStoneName: null,
      megaBattleOriginalPokemon: null,
      scoutingType: null,
      pcLocked: false,
      marketStock: null,
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
      pendingTypeBiases: { toward: [], honey: [] },
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(legacySavedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredBattleDebuffService = TestBed.inject(BattleDebuffService);
    expect(restoredBattleDebuffService.currentDebuff).toBe(0);
  });

  it('should save the pending marked target index to localStorage when it changes', () => {
    const markedTargetService = TestBed.inject(MarkedTargetService);
    markedTargetService.setMark(1);
    trainerService.addToTeam(makeTestPokemon());

    const stored = JSON.parse(localStorage.getItem(RUN_KEY)!) as SavedRun;
    expect(stored.markedTeamIndex).toBe(1);
  });

  it('should restore the pending marked target index from a saved run on construction', () => {
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
      pendingTypeBiases: { toward: [], honey: [] },
      newExperienceMode: true,
      pendingBattlePrep: null,
      dangerPercent: 5,
      consecutiveThreats: 0,
      guaranteedRewardSteps: 0,
      shieldedSteps: 0,
      pendingAdventure: null,
      pendingBattleDebuff: 0,
      markedTeamIndex: 1,
      pendingCatchEscapeChance: 0,
      coins: 0,
      megaBattleBaseId: null,
      megaBattleStoneName: null,
      megaBattleOriginalPokemon: null,
      scoutingType: null,
      pcLocked: false,
      marketStock: null,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(savedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredMarkedTargetService = TestBed.inject(MarkedTargetService);
    expect(restoredMarkedTargetService.currentMarkedIndex).toBe(1);
  });

  it('should default markedTeamIndex to null when restoring an older save without the field', () => {
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
      pendingTypeBiases: { toward: [], honey: [] },
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(legacySavedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredMarkedTargetService = TestBed.inject(MarkedTargetService);
    expect(restoredMarkedTargetService.currentMarkedIndex).toBeNull();
  });

  it('should save the pending scouting type to localStorage when it changes', () => {
    const scoutingReportService = TestBed.inject(ScoutingReportService);
    scoutingReportService.setType('fire');
    trainerService.addToTeam(makeTestPokemon());

    const stored = JSON.parse(localStorage.getItem(RUN_KEY)!) as SavedRun;
    expect(stored.scoutingType).toBe('fire');
  });

  it('should restore the pending scouting type from a saved run on construction', () => {
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
      pendingTypeBiases: { toward: [], honey: [] },
      newExperienceMode: true,
      pendingBattlePrep: null,
      dangerPercent: 5,
      consecutiveThreats: 0,
      guaranteedRewardSteps: 0,
      shieldedSteps: 0,
      pendingAdventure: null,
      pendingBattleDebuff: 0,
      markedTeamIndex: null,
      pendingCatchEscapeChance: 0,
      coins: 0,
      megaBattleBaseId: null,
      megaBattleStoneName: null,
      megaBattleOriginalPokemon: null,
      scoutingType: 'fire',
      pcLocked: false,
      marketStock: null,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(savedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredScoutingReportService = TestBed.inject(ScoutingReportService);
    expect(restoredScoutingReportService.currentType).toBe('fire');
  });

  it('should default scoutingType to null when restoring an older save without the field', () => {
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
      pendingTypeBiases: { toward: [], honey: [] },
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(legacySavedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredScoutingReportService = TestBed.inject(ScoutingReportService);
    expect(restoredScoutingReportService.currentType).toBeNull();
  });

  it('should save the PC lock to localStorage when it changes', () => {
    const pcLockService = TestBed.inject(PcLockService);
    pcLockService.setLock(true);
    trainerService.addToTeam(makeTestPokemon());

    const stored = JSON.parse(localStorage.getItem(RUN_KEY)!) as SavedRun;
    expect(stored.pcLocked).toBeTrue();
  });

  it('should restore the PC lock from a saved run on construction', () => {
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
      pendingTypeBiases: { toward: [], honey: [] },
      newExperienceMode: true,
      pendingBattlePrep: null,
      dangerPercent: 5,
      consecutiveThreats: 0,
      guaranteedRewardSteps: 0,
      shieldedSteps: 0,
      pendingAdventure: null,
      pendingBattleDebuff: 0,
      markedTeamIndex: null,
      pendingCatchEscapeChance: 0,
      coins: 0,
      megaBattleBaseId: null,
      megaBattleStoneName: null,
      megaBattleOriginalPokemon: null,
      scoutingType: null,
      pcLocked: true,
      marketStock: null,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(savedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredPcLockService = TestBed.inject(PcLockService);
    expect(restoredPcLockService.isLocked).toBeTrue();
  });

  it('should default pcLocked to false when restoring an older save without the field', () => {
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
      pendingTypeBiases: { toward: [], honey: [] },
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(legacySavedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredPcLockService = TestBed.inject(PcLockService);
    expect(restoredPcLockService.isLocked).toBeFalse();
  });

  it('should save the pending catch escape chance to localStorage when it changes', () => {
    const catchRiskService = TestBed.inject(CatchRiskService);
    catchRiskService.setEscapeChance(0.35);
    trainerService.addToTeam(makeTestPokemon());

    const stored = JSON.parse(localStorage.getItem(RUN_KEY)!) as SavedRun;
    expect(stored.pendingCatchEscapeChance).toBe(0.35);
  });

  it('should restore the pending catch escape chance from a saved run on construction', () => {
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
      pendingTypeBiases: { toward: [], honey: [] },
      newExperienceMode: true,
      pendingBattlePrep: null,
      dangerPercent: 5,
      consecutiveThreats: 0,
      guaranteedRewardSteps: 0,
      shieldedSteps: 0,
      pendingAdventure: null,
      pendingBattleDebuff: 0,
      markedTeamIndex: null,
      pendingCatchEscapeChance: 0.35,
      coins: 0,
      megaBattleBaseId: null,
      megaBattleStoneName: null,
      megaBattleOriginalPokemon: null,
      scoutingType: null,
      pcLocked: false,
      marketStock: null,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(savedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredCatchRiskService = TestBed.inject(CatchRiskService);
    expect(restoredCatchRiskService.currentEscapeChance).toBe(0.35);
  });

  it('should default pendingCatchEscapeChance to 0 when restoring an older save without the field', () => {
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
      pendingTypeBiases: { toward: [], honey: [] },
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(legacySavedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredCatchRiskService = TestBed.inject(CatchRiskService);
    expect(restoredCatchRiskService.currentEscapeChance).toBe(0);
  });

  it('should save the coin balance to localStorage when it changes', () => {
    trainerService.addCoins(25);

    const stored = JSON.parse(localStorage.getItem(RUN_KEY)!) as SavedRun;
    expect(stored.coins).toBe(25);
  });

  it('should restore the coin balance from a saved run on construction', () => {
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
      pendingTypeBiases: { toward: [], honey: [] },
      newExperienceMode: true,
      pendingBattlePrep: null,
      dangerPercent: 5,
      consecutiveThreats: 0,
      guaranteedRewardSteps: 0,
      shieldedSteps: 0,
      pendingAdventure: null,
      pendingBattleDebuff: 0,
      markedTeamIndex: null,
      pendingCatchEscapeChance: 0,
      coins: 42,
      megaBattleBaseId: null,
      megaBattleStoneName: null,
      megaBattleOriginalPokemon: null,
      scoutingType: null,
      pcLocked: false,
      marketStock: null,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(savedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredTrainerService = TestBed.inject(TrainerService);
    expect(restoredTrainerService.getCoins()).toBe(42);
  });

  it('should default coins to 0 when restoring an older save without the field', () => {
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
      pendingTypeBiases: { toward: [], honey: [] },
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(legacySavedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredTrainerService = TestBed.inject(TrainerService);
    expect(restoredTrainerService.getCoins()).toBe(0);
  });

  it('reverts a persisted active mega form after restore then leaving battle (regression)', () => {
    // Simulates a reload while a Venusaur (base id 3) is mega-evolved (id 10033):
    // the mega team is saved along with the mega battle state. Without persisting
    // that state, revert had nothing to restore and the mega became permanent.
    const megaTeam = [{
      pokemonId: 10033, text: 'pokemon.venusaur-mega', fillStyle: 'green',
      sprite: null, shiny: false, power: 5, weight: 1
    }];
    const original = {
      pokemonId: 3, text: 'pokemon.venusaur', fillStyle: 'green',
      sprite: null, shiny: false, power: 3, weight: 1
    };
    const savedRun: SavedRun = {
      state: 'gym-battle',
      stateStack: ['game-finish', 'champion-battle'],
      currentRound: 1,
      trainerTeam: megaTeam as any,
      storedPokemon: [],
      trainerItems: [],
      trainerBadges: [],
      gender: 'male',
      generationId: 1,
      pendingTypeBiases: { toward: [], honey: [] },
      newExperienceMode: true,
      pendingBattlePrep: null,
      dangerPercent: 5,
      consecutiveThreats: 0,
      guaranteedRewardSteps: 0,
      shieldedSteps: 0,
      pendingAdventure: null,
      pendingBattleDebuff: 0,
      markedTeamIndex: null,
      pendingCatchEscapeChance: 0,
      coins: 0,
      megaBattleBaseId: 3,
      megaBattleStoneName: 'venusaurite',
      megaBattleOriginalPokemon: original as any,
      scoutingType: null,
      pcLocked: false,
      marketStock: null,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(savedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);
    const restoredTrainerService = TestBed.inject(TrainerService);
    const restoredGameStateService = TestBed.inject(GameStateService);

    // Restored mid-battle: the mega form is still active.
    expect(restoredTrainerService.getTeam()[0].pokemonId).toBe(10033);

    // Leaving the battle now reverts, because the original was restored.
    restoredGameStateService.setNextState('adventure-continues');
    restoredGameStateService.finishCurrentState();
    expect(restoredTrainerService.getTeam()[0].pokemonId).toBe(3);
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
      pendingTypeBiases: { toward: [{ type: 'water', mode: 'soft' }], honey: [] },
      newExperienceMode: false,
      pendingBattlePrep: null,
      dangerPercent: 5,
      consecutiveThreats: 0,
      guaranteedRewardSteps: 0,
      shieldedSteps: 0,
      pendingAdventure: null,
      pendingBattleDebuff: 0,
      markedTeamIndex: null,
      pendingCatchEscapeChance: 0,
      coins: 0,
      megaBattleBaseId: null,
      megaBattleStoneName: null,
      megaBattleOriginalPokemon: null,
      scoutingType: null,
      pcLocked: false,
      marketStock: null,
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
    expect(stored.pendingTypeBiases).toEqual({ toward: [{ type: 'fire', mode: 'hard' }], honey: [] });
  });

  it('should restore the pending toward bias from a saved run on construction', () => {
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
      pendingTypeBiases: { toward: [{ type: 'water', mode: 'soft' }], honey: [] },
      newExperienceMode: false,
      pendingBattlePrep: null,
      dangerPercent: 5,
      consecutiveThreats: 0,
      guaranteedRewardSteps: 0,
      shieldedSteps: 0,
      pendingAdventure: null,
      pendingBattleDebuff: 0,
      markedTeamIndex: null,
      pendingCatchEscapeChance: 0,
      coins: 0,
      megaBattleBaseId: null,
      megaBattleStoneName: null,
      megaBattleOriginalPokemon: null,
      scoutingType: null,
      pcLocked: false,
      marketStock: null,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(savedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredTrainerService = TestBed.inject(TrainerService);
    expect(restoredTrainerService.currentPendingTypeBiases.toward).toEqual([{ type: 'water', mode: 'soft' }]);
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
      // Pre-rework saves may still carry a stray `away` field — normalization ignores it.
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
  });

  it('should restore pending Honey uses from a saved run on construction', () => {
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
      pendingTypeBiases: { toward: [], honey: [['fire', 'water']] },
      newExperienceMode: false,
      pendingBattlePrep: null,
      dangerPercent: 5,
      consecutiveThreats: 0,
      guaranteedRewardSteps: 0,
      shieldedSteps: 0,
      pendingAdventure: null,
      pendingBattleDebuff: 0,
      markedTeamIndex: null,
      pendingCatchEscapeChance: 0,
      coins: 0,
      megaBattleBaseId: null,
      megaBattleStoneName: null,
      megaBattleOriginalPokemon: null,
      scoutingType: null,
      pcLocked: false,
      marketStock: null,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(savedRun));

    TestBed.resetTestingModule();
    configureFreshTestBed();
    TestBed.inject(RunPersistenceService);

    const restoredTrainerService = TestBed.inject(TrainerService);
    expect(restoredTrainerService.currentPendingTypeBiases.honey).toEqual([['fire', 'water']]);
  });

  it('should treat a saved run with no honey field as having none, without throwing', () => {
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
      pendingTypeBiases: { toward: [], away: [] },
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(legacyRun));

    expect(() => {
      TestBed.resetTestingModule();
      configureFreshTestBed();
      TestBed.inject(RunPersistenceService);
    }).not.toThrow();

    const restoredTrainerService = TestBed.inject(TrainerService);
    expect(restoredTrainerService.currentPendingTypeBiases.honey).toEqual([]);
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

  // ── startFreshRun — single source of truth for restarting a run ─────────
  // Regression coverage for the "toggling New Experience Mode needs two
  // restarts" bug: a stale committed battlePrepService entry (or any other
  // per-run ancillary service) surviving a restart could make the new run's
  // first battle behave like the previous run instead of the fresh setting.

  describe('startFreshRun', () => {
    it('clears every per-run ancillary service, not just trainer/game state', () => {
      const battlePrepService = TestBed.inject(BattlePrepService);
      const dangerMeterService = TestBed.inject(DangerMeterService);
      const adventureDrawService = TestBed.inject(AdventureDrawService);
      const battleDebuffService = TestBed.inject(BattleDebuffService);
      const markedTargetService = TestBed.inject(MarkedTargetService);
      const catchRiskService = TestBed.inject(CatchRiskService);
      const scoutingReportService = TestBed.inject(ScoutingReportService);
      const pcLockService = TestBed.inject(PcLockService);

      trainerService.addToTeam(makeTestPokemon());
      trainerService.addToTeam(makeTestPokemon({ pokemonId: 4 }));
      battlePrepService.commitPrep({ battleKey: 'gym-battle', leadIndex: 0, xAttackUsed: false });
      dangerMeterService.restore(45, 2);
      adventureDrawService.commitDraw('reward', ['catchPokemon']);
      battleDebuffService.setDebuff(2);
      markedTargetService.setMark(1);
      catchRiskService.setEscapeChance(0.35);
      scoutingReportService.setType('fire');
      pcLockService.setLock(true);

      service.startFreshRun(true);

      expect(battlePrepService.getPendingPrep()).toBeNull();
      expect(dangerMeterService.currentDangerPercent).toBe(5);
      expect(dangerMeterService.currentConsecutiveThreats).toBe(0);
      expect(adventureDrawService.getPendingDraw()).toBeNull();
      expect(battleDebuffService.currentDebuff).toBe(0);
      expect(markedTargetService.currentMarkedIndex).toBeNull();
      expect(catchRiskService.currentEscapeChance).toBe(0);
      expect(scoutingReportService.currentType).toBeNull();
      expect(pcLockService.isLocked).toBeFalse();
      expect(gameStateService.isNewExperienceMode).toBeTrue();
      expect(localStorage.getItem(RUN_KEY)).toBeNull();
    });

    it('resets trainer team/items to the default starting kit and applies the requested New Experience Mode value', () => {
      trainerService.addToTeam(makeTestPokemon());
      trainerService.addToItems({ name: 'super-potion', text: '', fillStyle: '', weight: 1, description: '', sprite: 'x' });

      service.startFreshRun(false);

      expect(trainerService.getTeam().length).toBe(0);
      // resetItems() restores the default starting kit (Potion/Honey/Repel), not an empty bag.
      expect(trainerService.getItems().some(i => i.name === 'super-potion')).toBeFalse();
      expect(gameStateService.isNewExperienceMode).toBeFalse();
    });
  });

});
